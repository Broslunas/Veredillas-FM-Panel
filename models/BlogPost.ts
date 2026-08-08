import mongoose, { Schema } from 'mongoose';

export interface IBlogPost {
  _id: mongoose.Types.ObjectId;
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  author: string;
  image?: string;
  tags?: string[];
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogPostSchema = new Schema<IBlogPost>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    pubDate: { type: Date, required: true, default: Date.now },
    author: { type: String, default: 'Redacción Veredillas' },
    image: { type: String },
    tags: { type: [String] },
    body: { type: String, default: '' },
  },
  { timestamps: true }
);

if (mongoose.models.BlogPost) {
  delete mongoose.models.BlogPost;
}

const BlogPost = mongoose.model<IBlogPost>('BlogPost', BlogPostSchema);
export default BlogPost;
