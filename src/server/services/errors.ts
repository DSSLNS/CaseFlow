export class ServiceError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}
