# AI Internship Platform - SIH 2025

An AI-powered internship matching platform built with Next.js frontend and FastAPI backend for Smart India Hackathon 2025.

## 🚀 Features

- **AI-Powered Matching**: Intelligent internship recommendations based on student profiles
- **Multi-Portal System**: Separate dashboards for Students, Companies, and Admins
- **Real-time Analytics**: Track applications, matches, and completion rates
- **Profile Management**: Comprehensive student and company profile systems
- **Allocation System**: Automated internship allocation algorithms

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 with TypeScript
- Tailwind CSS
- shadcn/ui components
- React Hooks for state management

**Backend:**
- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL/SQLite Database
- AI/ML matching algorithms

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **Python** (v3.8 or higher)
- **npm/pnpm** (for frontend dependencies)
- **pip** (for Python packages)

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/SIH_2025_FB.git
cd SIH_2025_FB
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
# Edit .env file with your database credentials and API keys

# Run database migrations (if applicable)
# python -m alembic upgrade head

# Start the backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be running at `http://localhost:8000`

### 3. Frontend Setup

```bash
# Navigate to frontend directory (from project root)
cd ai-internship-platform

# Install dependencies
npm install
# or if using pnpm:
# pnpm install

# Create environment file
cp .env.local.example .env.local
# Edit .env.local with your API endpoints

# Start the development server
npm run dev
# or with pnpm:
# pnpm dev
```

The frontend will be running at `http://localhost:3000`

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start Backend** (Terminal 1):
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. **Start Frontend** (Terminal 2):
```bash
cd ai-internship-platform
npm run dev
```

3. **Access the Application**:
   - Frontend: `http://localhost:3000`
   - Backend API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

### Production Build

**Frontend:**
```bash
cd ai-internship-platform
npm run build
npm start
```

**Backend:**
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 📁 Project Structure

```
SIH_2025_FB/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── models.py       # Database models
│   │   ├── crud.py         # Database operations
│   │   ├── db.py           # Database configuration
│   │   └── routers/        # API route handlers
│   ├── requirements.txt    # Python dependencies
│   └── .env               # Environment variables
├── ai-internship-platform/ # Next.js frontend
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── lib/              # Utility functions
│   ├── package.json      # Node.js dependencies
│   └── .env.local        # Frontend environment variables
└── README.md
```

## 🌐 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Students
- `GET /students/profile/{id}` - Get student profile
- `PUT /students/profile/{id}` - Update student profile
- `GET /students/matches/{id}` - Get internship matches

### Companies
- `GET /companies/profile/{id}` - Get company profile
- `POST /internships/` - Create internship posting
- `GET /internships/applicants/{id}` - Get applicants

### Admin
- `GET /admin/dashboard` - Admin dashboard data
- `POST /admin/allocate` - Run allocation algorithm

## 🔑 Environment Variables

### Backend (.env)
```env
DATABASE_URL=sqlite:///./test.db
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 🧪 Testing

**Backend Tests:**
```bash
cd backend
pytest
```

**Frontend Tests:**
```bash
cd ai-internship-platform
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

- **Team Name**: [Your Team Name]
- **SIH 2025 Problem Statement**: [PS Number and Title]

## 📞 Support

For support and queries, please contact:
- Email: your-email@example.com
- GitHub Issues: [Create an issue](https://github.com/YOUR_USERNAME/SIH_2025_FB/issues)

---

Made with ❤️ for Smart India Hackathon 2025