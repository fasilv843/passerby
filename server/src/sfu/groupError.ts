/** An error whose message is safe to show the user (room full, room not found, ...). */
export class GroupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupError";
  }
}
