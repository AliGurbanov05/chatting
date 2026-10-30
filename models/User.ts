
export interface IUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserPublic {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export const USER_VALIDATION = {
  name: {
    minLength: 2,
    maxLength: 50,
  },
  email: {
    maxLength: 255,
  },
  password: {
    minLength: 8,
    maxLength: 72,
  },
} as const;
