export class ApiResponse<T = any> {
  statusCode: number;
  data: T;
  message: string;

  constructor(statusCode: number, data: T, message: string) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }
}
