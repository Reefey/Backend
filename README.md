# Reefey - Marine Life Identification App

## 🌊 Overview

Reefey is a comprehensive marine life identification application that combines AI-powered photo analysis with a comprehensive database of marine species. The app helps snorkelers and divers identify marine life they encounter underwater, track their discoveries, and learn about marine biodiversity.

## 🏗️ Project Architecture

Reefey consists of two main components:

### 📱 Frontend (Mobile App)
- **Platform**: iOS/Android mobile application
- **Technology**: React Native or native mobile development
- **Features**: 
  - Camera integration for photo capture
  - Photo gallery and collection management
  - Species identification results display
  - Offline capability for basic functionality
  - User profile and discovery tracking

### 🔧 Backend (API Server)
- **Platform**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: OpenAI GPT-4 Vision API
- **Features**:
  - Marine species identification via AI
  - Photo storage and processing
  - User collection management
  - Snorkeling spots database
  - RESTful API endpoints

## 🚀 Quick Start

### For Backend Development
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd reefey-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   - Follow [Supabase Setup Guide](Instruction/Supabase.md)
   - Run [Database Schema](Instruction/Database-Schema.sql)
   - Insert [Sample Data](Instruction/Database-Data.sql)

5. **Start development server**
   ```bash
   npm run dev
   ```

### For Frontend Development
*Frontend documentation will be added when the mobile app is developed*

## 📚 Documentation

### 📖 [INDEX.md](./INDEX.md) - Complete Documentation Guide
Start here for a comprehensive overview of all available documentation.

### 🔧 [Backend Implementation Guide](Instruction/Backend.md)
Complete backend development guide with architecture, setup, and implementation details.

### 📚 [API Reference](Instruction/API-Reference.md)
Complete API documentation with all endpoints, request/response formats, and examples.

### 🗄️ [Database Setup](Instruction/Database-Schema.sql)
Database schema creation and setup instructions.

### 📊 [Sample Data](Instruction/Database-Data.sql)
Sample marine species and snorkeling spots data.

### ⚙️ [Supabase Configuration](Instruction/Supabase.md)
Step-by-step Supabase setup and configuration guide.

## 🎯 Core Features

### Marine Life Identification
- **AI-Powered Analysis**: Uses OpenAI GPT-4 Vision API for species detection
- **Multi-Species Detection**: Identifies multiple species in a single image
- **Bounding Box Generation**: Provides coordinates for each detected species
- **Confidence Scoring**: Returns confidence levels for each identification
- **Automatic Image URLs**: Automatically fetches high-quality images from reliable sources for new species
- **Visual Species Preview**: Users can see what their fish looks like immediately after identification

### Snorkeling Spots Management
- **Location-Based Search**: Find spots by coordinates and radius
- **Marine Species Mapping**: Each spot shows what species can be found there
- **Difficulty Ratings**: Easy, Medium, Hard classifications
- **Seasonal Information**: When species are typically found

### Collection Management
- **Personalized Filtering**: Filter marine species by collection status (collected/not collected)
- **Progress Tracking**: See which species you've found and which ones you still need
- **Device-Specific Collections**: Each user's collection is tracked separately

### User Collections
- **Personal Findings**: Users track their marine life discoveries
- **Photo Management**: Store multiple photos per species
- **Location Tracking**: GPS coordinates and spot associations
- **AI Integration**: Automatic species identification and database linking

### Marine Species Database
- **Comprehensive Catalog**: 30+ species with detailed information
- **Scientific Data**: Size, habitat, diet, behavior, danger levels
- **Conservation Status**: Endangered status and fun facts
- **Image Storage**: Each species can have reference images

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: OpenAI GPT-4 Vision API
- **Image Processing**: Sharp + Canvas
- **Documentation**: Swagger UI
- **Validation**: Joi
- **Security**: Helmet, CORS, Rate Limiting

### Frontend (Planned)
- **Framework**: React Native or Native iOS/Android
- **State Management**: Redux or Context API
- **Navigation**: React Navigation
- **Camera**: React Native Camera
- **Storage**: AsyncStorage + Cloud Sync
- **UI**: Native components or UI library

## 🌍 Environment Setup

### Required Services
- **Supabase Account**: For database and storage
- **OpenAI API Key**: For AI-powered species identification
- **Development Environment**: Node.js 18+, npm/yarn

### Environment Variables
```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# AI Configuration
AI_RATE_LIMIT_PER_DAY=10
AI_CONFIDENCE_THRESHOLD=0.7
AI_MAX_FILE_SIZE=10485760
AI_TIMEOUT=30000

# Storage Configuration (Single bucket)
STORAGE_BUCKET=reefey-photos
```

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Test environment
npm run test:env

# Test Supabase connection
npm run test:supabase
```

## 📱 API Access

Once the server is running:
- **API Documentation**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/api/health
- **API Root**: http://localhost:3000/

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🐠 About Reefey

Reefey aims to promote marine conservation by helping people identify and learn about marine life. By making species identification accessible and educational, we hope to foster a deeper appreciation for ocean biodiversity and encourage responsible snorkeling and diving practices.

---

**Ready to explore the ocean? Start with the [Backend Implementation Guide](Instruction/Backend.md) to get the API running!**
