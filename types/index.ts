// types/index.ts

export interface UserProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export interface Car {
  id: string; // Document ID
  plateNumber: string;
  model: string;
  isRental: boolean;
  isActive: boolean;
}

export interface Booking {
  id?: string;
  carId: string;
  carName: string;
  bookerId: string;
  bookerName: string;
  startDatetime: string; // ISO String format
  endDatetime: string;   // ISO String format
  destination: string;
  purpose: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt?: any; // Firestore Timestamp
}