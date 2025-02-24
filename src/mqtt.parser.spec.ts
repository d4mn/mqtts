import {
  MalformedPacketError,
  MqttTransformer,
  PingResponsePacket,
  SubscribeResponsePacket,
  UnexpectedPacketError,
} from './index';
import { Readable } from 'stream';
import { assertIteratorDone, assertTransformerIteratorValueInstanceOf } from '../test/utilities';
import { assert, use } from 'chai';
// eslint-disable-next-line @typescript-eslint/no-var-requires
use(require('chai-as-promised'));

function* validPingResponse() {
  yield Buffer.from('d000', 'hex');
}

function* incompletePingResponse() {
  yield Buffer.from('d0', 'hex');
}

function* splitPingResponse() {
  yield Buffer.from('d0', 'hex');
  yield Buffer.from('00', 'hex');
}

function* invalidType() {
  yield Buffer.from('f0', 'hex');
}

function* malformedPacket() {
  // 3 isn't a valid return code
  yield Buffer.from('9003000103', 'hex');
}

function* twoPackets() {
  yield Buffer.from('d0009003000100', 'hex');
}

function* twoSplitPackets() {
  yield Buffer.from('d0009003', 'hex');
  yield Buffer.from('000100', 'hex');
}

describe('MqttTransformer', function () {
  it('parses valid packets', async function () {
    const iterator = Readable.from(validPingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assertTransformerIteratorValueInstanceOf(iterator, PingResponsePacket);
    await assertIteratorDone(iterator);
  });

  it('parses multiple packets in the same chunk', async function () {
    const iterator = Readable.from(twoPackets()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assertTransformerIteratorValueInstanceOf(iterator, PingResponsePacket);
    await assertTransformerIteratorValueInstanceOf(iterator, SubscribeResponsePacket);
    await assertIteratorDone(iterator);
  });

  it('parses multiple packets in different chunks', async function () {
    const iterator = Readable.from(twoSplitPackets()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assertTransformerIteratorValueInstanceOf(iterator, PingResponsePacket);
    await assertTransformerIteratorValueInstanceOf(iterator, SubscribeResponsePacket);
    await assertIteratorDone(iterator);
  });

  it('is empty on EOL', async function () {
    const iterator = Readable.from(incompletePingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assertIteratorDone(iterator);
  });

  it('joins chunks on EOL', async function () {
    const iterator = Readable.from(splitPingResponse()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assertTransformerIteratorValueInstanceOf(iterator, PingResponsePacket);
  });

  it('errors on invalid type', async function () {
    const iterator = Readable.from(invalidType()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assert.isRejected(iterator.next(), UnexpectedPacketError, 'No packet found for 15; @0 len: 1');
  });

  it('errors on malformed packet', async function () {
    const iterator = Readable.from(malformedPacket()).pipe(new MqttTransformer())[Symbol.asyncIterator]();
    await assert.isRejected(
      iterator.next(),
      MalformedPacketError,
      'Error in parser (type: SUBACK): Received invalid return codes - stream: kAMAAQM=',
    );
  });
});
