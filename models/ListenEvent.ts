import mongoose, { Schema, Document } from 'mongoose';

export interface IListenEvent extends Document {
  episodeSlug: string;
  timestamp: Date;
  userId?: string;
  userAgent?: string;
  ip?: string;
  duration?: number;
}

const ListenEventSchema = new Schema<IListenEvent>({
  episodeSlug: { 
    type: String, 
    required: true,
    index: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  userId: { 
    type: String, 
    required: false 
  },
  userAgent: String,
  ip: String,
  duration: Number
});

ListenEventSchema.index({ timestamp: -1, episodeSlug: 1 });

if (mongoose.models.ListenEvent) {
  delete mongoose.models.ListenEvent;
}

const ListenEvent = mongoose.model<IListenEvent>('ListenEvent', ListenEventSchema);
export default ListenEvent;
