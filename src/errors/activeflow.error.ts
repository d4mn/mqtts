import { CustomError } from 'ts-custom-error';

export class ActiveFlowError extends CustomError {
    constructor(public status: string, public count: number) {
        super(status);
    }
}
