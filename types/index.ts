// types/index.ts

export type UserRole = "admin" | "employee";

export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  role?: UserRole;
}

export interface Car {
  id: string;
  name: string;
  plate: string;
  model: string;
  imageUrl: string;
  badge: string;
}

export interface Booking {
  id?: string;

  carId: string;
  carName: string;
  carPlate: string;

  bookerId: string;
  bookerName: string;
  bookedAt?: string;

  driverName: string;
  fromLocation: string;
  toLocation: string;
  purpose: string;

  useDate: string;
  startTime: string;
  endTime: string;

  fuel?: string;
  status: "booked" | "active" | "completed" | "cancelled";
  createdAt?: any;
  cancelledAt?: string;
  cancelledBy?: string;
}