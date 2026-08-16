import mongoose, { Schema, Document } from 'mongoose';
import type { PermissionOverrides } from '@/lib/permissions';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  googleId?: string;
  spotifyId?: string;
  email: string;
  name: string;
  picture?: string;
  bio?: string;
  role: 'user' | 'editor' | 'admin' | 'owner';
  /** Per-section overrides on top of the role defaults. See lib/permissions.ts */
  permissions?: PermissionOverrides;
  favorites?: string[];
  listeningTime?: number;
  completedEpisodes?: string[];
  playbackHistory?: {
    episodeSlug: string;
    progress: number;
    duration: number;
    listenedAt: Date;
    completed: boolean;
  }[];
  currentStreak?: number;
  maxStreak?: number;
  newsletter?: boolean;
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
    role: { type: String, enum: ['user', 'editor', 'admin', 'owner'], default: 'user' },
    permissions: { type: Schema.Types.Mixed, default: undefined },
    favorites: { type: [String], default: [] },
    listeningTime: { type: Number, default: 0 },
    completedEpisodes: { type: [String], default: [] },
    playbackHistory: [{
      episodeSlug: { type: String, required: true },
      progress: { type: Number, default: 0 },
      duration: { type: Number, default: 0 },
      listenedAt: { type: Date, default: Date.now },
      completed: { type: Boolean, default: false }
    }],
    currentStreak: { type: Number, default: 0 },
    maxStreak: { type: Number, default: 0 },
    newsletter: { type: Boolean, default: true },
    lastLogin: { type: Date, default: Date.now },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: false }
);

if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model<IUser>('User', userSchema);
export default User;

