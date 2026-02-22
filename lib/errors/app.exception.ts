import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppErrorPayload {
  code: string;
  message: string;
}

export class AppException extends HttpException {
  constructor(error: AppErrorPayload, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ code: error.code, message: error.message }, status);
  }
}
