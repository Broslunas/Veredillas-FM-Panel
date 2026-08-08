import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId?: string;
  spotifyId?: string;
  email: string;
  name: string;
  picture?: string;
  bio?: string;
  role: 'user' | 'admin' | 'owner';
  lastLogin: Date;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    googleId: { type: String, default: undefined },
    spotifyId: { type: String, default: undefined },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    picture: { type: String },
    bio: { type: String, maxlength: 500 },
    role: { type: String, enum: ['user', 'admin', 'owner'], default: 'user' },
    lastLogin: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model<IUser>('User', userSchema);
export default User;
