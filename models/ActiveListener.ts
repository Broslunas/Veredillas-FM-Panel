import mongoose from 'mongoose';

// Schema to track active users/listeners for social proof
// Documents auto-expire after 5 minutes (300 seconds) of inactivity via MongoDB TTL index
const ActiveListenerSchema = new mongoose.Schema({
  sessionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  lastSeen: { 
    type: Date, 
    default: Date.now,
    expires: 300
  },
  path: {
    type: String,
    default: '/'
  },
  userAgent: String,
  userId: { type: String, required: false },
  name: { type: String, required: false },
  picture: { type: String, required: false }
});

export default mongoose.models.ActiveListener || mongoose.model('ActiveListener', ActiveListenerSchema);
