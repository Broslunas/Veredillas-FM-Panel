import mongoose, { Schema, Document } from 'mongoose';

export interface IComment extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  email: string;
  text?: string;
  createdAt: Date;
  likes: string[];
  parentId?: string | mongoose.Types.ObjectId;
  attachments?: string[];
  isVerified: boolean;
  rating: number;
  verificationToken?: string;
  deletionToken?: string;
}

const CommentSchema = new Schema<IComment>(
  {
    slug: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    text: {
      type: String,
      maxlength: 1500,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    likes: {
      type: [String],
      default: [],
    },
    verificationToken: {
      type: String,
      select: false,
    },
    deletionToken: {
      type: String,
      select: false,
    },
  },
  { timestamps: true }
);

if (mongoose.models.Comment) {
  delete mongoose.models.Comment;
}

const Comment = mongoose.model<IComment>('Comment', CommentSchema);
export default Comment;
