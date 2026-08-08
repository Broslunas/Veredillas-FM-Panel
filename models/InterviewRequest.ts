import mongoose, { Schema, Document } from 'mongoose';

export interface IInterviewRequest extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  description?: string;
  preferredDate?: Date;
  token?: string;
  status: 'pending' | 'invited' | 'approved' | 'rejected' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

const interviewRequestSchema = new Schema<IInterviewRequest>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    preferredDate: {
      type: Date,
    },
    token: {
      type: String,
      unique: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['pending', 'invited', 'approved', 'rejected', 'completed'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

if (mongoose.models.InterviewRequest) {
  delete mongoose.models.InterviewRequest;
}

const InterviewRequest = mongoose.model<IInterviewRequest>('InterviewRequest', interviewRequestSchema);
export default InterviewRequest;
