// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json());

// --- static files ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'views')));

// --- MongoDB ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/my_recipe_book';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('✅ MongoDB connected'))
  .catch(err => console.error('MongoDB error', err));

// --- Schemas ---
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: { type: String, required: true },
  email: String,
  profilePic: String
}, { timestamps: true });

const RecipeSchema = new Schema({
  name: { type: String, required: true },
  user: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  category: String,
  image: String,
  description: String,
  ingredients: String,
  steps: String,
  views: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const FeedbackSchema = new Schema({
  recipeId: { type: Schema.Types.ObjectId, ref: 'Recipe', required: true },
  user: String,
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Recipe = mongoose.model('Recipe', RecipeSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);

// --- Multer config ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({ storage });

// --- Routes ---

app.get('/api/ping', (_,res) => res.send('pong'));

// login/register simple
app.post('/api/login', async (req,res) => {
  try {
    const { username, email } = req.body;
    if (!username) return res.status(400).send('username required');
    let user = await User.findOne({ username, email });
    if (!user) user = await User.create({ username, email });
    res.json(user);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// get user & their recipes
app.get('/api/user/:id', async (req,res) => {
  try {
    const user = await User.findById(req.params.id).lean();
    if (!user) return res.status(404).send('User not found');
    const recipes = await Recipe.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    res.json({ user, recipes });
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// upload profile pic
app.post('/api/user/:id/upload', upload.single('profilePic'), async (req,res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send('User not found');
    if (!req.file) return res.status(400).send('No file uploaded');
    const rel = `/uploads/${req.file.filename}`;
    user.profilePic = rel;
    await user.save();
    res.json({ message:'Profile updated', profilePic: rel });
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// create recipe (supports image file upload OR imageUrl field)
app.post('/api/recipes', upload.single('image'), async (req,res) => {
  try {
    const data = req.body || {};
    let imagePath = '';
    if (req.file) imagePath = `/uploads/${req.file.filename}`;
    else if (data.imageUrl) imagePath = data.imageUrl;
    const r = await Recipe.create({
      name: data.name,
      user: data.user || 'Anonymous',
      userId: data.userId || null,
      category: data.category || '',
      image: imagePath,
      description: data.description || '',
      ingredients: data.ingredients || '',
      steps: data.steps || ''
    });
    res.json(r);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// top recipes
app.get('/api/recipes/top', async (req,res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const top = await Recipe.find().sort({ views: -1 }).limit(limit).lean();
    res.json(top);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// all recipes
app.get('/api/recipes', async (req,res) => {
  try {
    const all = await Recipe.find().sort({ createdAt: -1 }).lean();
    res.json(all);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// single recipe + increment views
app.get('/api/recipes/:id', async (req,res) => {
  try {
    const id = req.params.id;
    const recipe = await Recipe.findByIdAndUpdate(id, { $inc: { views: 1 } }, { new: true }).lean();
    if (!recipe) return res.status(404).send('Recipe not found');
    const feedbacks = await Feedback.find({ recipeId: id }).sort({ createdAt: -1 }).lean();
    res.json({ recipe, feedbacks });
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// add feedback
app.post('/api/recipes/:id/feedback', async (req,res) => {
  try {
    const { user, comment } = req.body;
    if (!comment) return res.status(400).send('Comment required');
    const fb = await Feedback.create({ recipeId: req.params.id, user: user || 'Guest', comment });
    res.json(fb);
  } catch (err) { console.error(err); res.status(500).send('Server error'); }
});

// --- Seed demo (your version) ---
async function seedDemo() {
  try {
    const count = await Recipe.countDocuments();
    if (count === 0) {
      console.log('Seeding demo recipes...');

      const demo = [
        {
          name: 'Tiramisu Dessert',
          user: 'Admin',
          category: 'Dessert',
          image: 'https://images.unsplash.com/photo-1662230791691-b77f85c5b43a?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
          description: 'Creamy layered tiramisu.',
          ingredients: 'Coffee, Mascarpone, Cream, Cocoa'
        },
        {
          name: 'Paneer Butter Masala',
          user: 'HomeCook',
          category: 'Veg',
          image: 'https://images.unsplash.com/photo-1701579231378-3726490a407b?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8cGFuZWVyJTIwYnV0dGVyJTIwbWFzYWxhfGVufDB8fDB8fHww',
          description: 'Creamy rich paneer curry.',
          ingredients: 'Paneer, Butter, Tomato gravy'
        },
        {
          name: 'Mango Smoothie',
          user: 'Summer',
          category: 'Beverage',
          image: 'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8bWFuZ28lMjBzbW9vdGhpZXxlbnwwfHwwfHx8MA%3D%3D',
          description: 'Refreshing chilled mango drink.',
          ingredients: 'Mango, Milk, Ice'
        },
        {
          name: 'Veg Palav',
          user: 'Sindhu',
          category: 'Main Course',
          image: 'https://media.istockphoto.com/id/2212836819/photo/indian-veg-biryani-veg-pulav-indian-vegetable-pulav-biriyani-vegetable-biriyani-served-in-a.jpg?s=1024x1024&w=is&k=20&c=csRuG2qb6UYNd7NQEDAe_T2xZw7hgRkHa2OQIsoE0aM=',
          description: 'South Indian style spicy palav.',
          ingredients: 'Rice, Vegetables, Spices'
        },
        {
          name: 'Eggless Strawberry Shortcake',
          user: 'Sindhu',
          category: 'Dessert',
          image: 'https://media.istockphoto.com/id/1298962313/photo/strawberry-cake-slice-with-strawberry-cream-cheese-frosting.jpg?s=1024x1024&w=is&k=20&c=FA208DxAX0LdHFYvc99ZhwuZw7ThjQPt0ZiUH6IpFjI=',
          description: 'Soft sponge with strawberry & cream.',
          ingredients: 'Flour, Cream, Strawberries'
        },
        {
          name: 'Brown Butter Brownies',
          user: 'Chef A',
          category: 'Dessert',
          image: 'https://images.unsplash.com/photo-1631642034885-4f4ef938f32a?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8YnJvd24lMjBidXR0ZXIlMjBjb29raWVzfGVufDB8fDB8fHww',
          description: 'Rich dark chocolate brownies.',
          ingredients: 'Cocoa, Butter, Sugar'
        }
      ];

      await Recipe.insertMany(demo);
      console.log('Demo recipes inserted.');
    }
  } catch (err) {
    console.error('Seed error', err);
  }
}

seedDemo().then(() => {
  const PORT = process.env.PORT || 4000;

  app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
});
