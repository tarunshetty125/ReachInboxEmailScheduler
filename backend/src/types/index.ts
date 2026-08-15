export interface EmailJobPayload {
  emailId: string;
  senderId: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
