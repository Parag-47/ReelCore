class ValidationError extends Error {
  constructor(field = null, message) {
    super(message);
    this.field = field;
  }
}

export default ValidationError;
