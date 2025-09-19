from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List
from app.db import get_db

router = APIRouter(prefix="/auth", tags=["authentication"])

# Models
class CandidateLogin(BaseModel):
    email: EmailStr
    password: str

class CandidateResponse(BaseModel):
    student_id: int
    name: str
    email: str

class CandidateRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    ext_id: Optional[str] = None
    degree: Optional[str] = None
    cgpa: Optional[float] = None
    grad_year: Optional[int] = None
    highest_qualification: Optional[str] = None
    tenth_percent: Optional[float] = None
    twelfth_percent: Optional[float] = None
    location_pref: Optional[str] = None
    pincode: Optional[str] = None
    willing_radius_km: Optional[int] = 20
    category_code: str = "GEN"
    disability_code: str = "NONE"
    languages_json: Optional[str] = None
    skills_text: Optional[str] = None
    resume_url: Optional[str] = None
    resume_summary: Optional[str] = None

class CompanyResponse(BaseModel):
    org_id: int
    org_name: str
    org_email: str

class CompanyLogin(BaseModel):
    email: EmailStr
    password: str

class CompanyRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    website: str

@router.post("/candidates/login", response_model=CandidateResponse)
async def login_candidate(login_data: CandidateLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a candidate using email and password from the student table
    """
    # Query the database using the email_password index
    query = text("""
        SELECT student_id, name, email 
        FROM student 
        WHERE email = :email AND password = :password
    """)
    
    result = await db.execute(
        query, 
        {"email": login_data.email, "password": login_data.password}
    )
    
    candidate = result.mappings().first()
    
    
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Return the candidate information
    return {
        "student_id": candidate["student_id"],
        "name": candidate["name"],
        "email": candidate["email"]
    }

@router.post("/candidates/register", response_model=CandidateResponse)
async def register_candidate(student_data: CandidateRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new candidate or update an existing one with complete profile data
    """
    # Check if the email already exists
    check_query = text("SELECT student_id FROM student WHERE email = :email")
    result = await db.execute(check_query, {"email": student_data.email})
    existing_student = result.scalar()


    try:
        if existing_student:
            # Update existing student
            update_query = text("""
                UPDATE student SET
                    name = :name,
                    phone = :phone,
                    ext_id = :ext_id,
                    degree = :degree,
                    cgpa = :cgpa,
                    grad_year = :grad_year,
                    highest_qualification = :highest_qualification,
                    tenth_percent = :tenth_percent,
                    twelfth_percent = :twelfth_percent,
                    location_pref = :location_pref,
                    pincode = :pincode,
                    willing_radius_km = :willing_radius_km,
                    category_code = :category_code,
                    disability_code = :disability_code,
                    languages_json = :languages_json,
                    skills_text = :skills_text,
                    resume_url = :resume_url,
                    resume_summary = :resume_summary,
                    password = :password,
                    updated_at = CURRENT_TIMESTAMP
                WHERE email = :email
                RETURNING student_id
            """)
            
            result = await db.execute(update_query, dict(student_data))
            student_id = result.scalar()
            
            # Clear existing skills for this student
            await db.execute(
                text("DELETE FROM student_skill WHERE student_id = :student_id"),
                {"student_id": student_id}
            )
            
        else:
            # Only if absolutely necessary:
            # result = await db.execute(text("SELECT COALESCE(MAX(student_id), 0) + 1 FROM student"))
            # next_id = result.scalar()
            # reset_index = text("ALTER TABLE student ALTER COLUMN student_id RESTART WITH :new_id")
            # await db.execute(reset_index, {"new_id": next_id})
            # Create new student
            insert_query = text("""
                INSERT INTO student (
                    name, email, phone, ext_id, degree, cgpa, grad_year, 
                    highest_qualification, tenth_percent, twelfth_percent, 
                    location_pref, pincode, willing_radius_km, category_code, 
                    disability_code, languages_json, skills_text, resume_url, 
                    resume_summary, password
                ) VALUES (
                    :name, :email, :phone, :ext_id, :degree, :cgpa, :grad_year,
                    :highest_qualification, :tenth_percent, :twelfth_percent,
                    :location_pref, :pincode, :willing_radius_km, :category_code,
                    :disability_code, :languages_json, :skills_text, :resume_url,
                    :resume_summary, :password
                )
                RETURNING student_id
            """)
            
            result = await db.execute(insert_query, dict(student_data))
            student_id = result.scalar()
        
        # If skills were submitted, add them to the student_skill table
        if student_data.skills_text:
            # Extract skill names from the comma-separated text
            skill_names = [s.strip() for s in student_data.skills_text.split(",")]
            
            # Get skill IDs for these names
            for skill_name in skill_names:
                skill_id_query = text("""
                    SELECT skill_code FROM skill_ref WHERE name = :name
                """)
                skill_result = await db.execute(skill_id_query, {"name": skill_name})
                skill_code = skill_result.scalar()
                
                if skill_code:
                    # Add to student_skill table
                    await db.execute(
                        text("""
                            INSERT INTO student_skill (student_id, skill_code)
                            VALUES (:student_id, :skill_code)
                            ON CONFLICT (student_id, skill_code) DO NOTHING
                        """),
                        {"student_id": student_id, "skill_code": skill_code}
                    )
        
        await db.commit()
        
        # Return the student information
        return {
            "student_id": student_id,
            "name": student_data.name,
            "email": student_data.email
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register student: {str(e)}"
        )

@router.get("/skills")
async def get_skills(db: AsyncSession = Depends(get_db)):
    """Get all available skills from the skill_ref table"""
    query = text("SELECT skill_code, name, nsqf_level FROM skill_ref ORDER BY name")
    result = await db.execute(query)
    skills = [{"skill_code": row.skill_code, "name": row.name, "nsqf_level": row.nsqf_level} 
              for row in result]
    return skills


@router.post("/companies/login", response_model=CompanyResponse)
async def login_company(login_data: CompanyLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate a company using email and password
    """
    query = text("""
        SELECT org_id, org_name, org_email 
        FROM organization 
        WHERE org_email = :email AND password = :password
    """)
    
    result = await db.execute(
        query, 
        {"email": login_data.email, "password": login_data.password}
    )
    
    company = result.mappings().first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Return the company information
    return {
        "org_id": company["org_id"],
        "org_name": company["org_name"],
        "org_email": company["org_email"]
    }

@router.post("/companies/register", response_model=CompanyResponse)
async def register_company(company_data: CompanyRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new company
    """
    # Check if the email already exists
    check_query = text("SELECT org_id FROM organization WHERE org_email = :email")
    result = await db.execute(check_query, {"email": company_data.email})
    existing_company_email = result.scalar()
    
    # Check if the company name already exists
    check_name_query = text("SELECT org_id FROM organization WHERE org_name = :name")
    name_result = await db.execute(check_name_query, {"name": company_data.name})
    existing_company_name = name_result.scalar()
    
    if existing_company_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
        
    if existing_company_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company name already exists"
        )

    try:
        # Insert new company
        insert_query = text("""
            INSERT INTO organization (
                org_name, org_email, org_website, password
            ) VALUES (
                :name, :email, :website, :password
            )
            RETURNING org_id
        """)
        
        result = await db.execute(insert_query, {
            "name": company_data.name,
            "email": company_data.email,
            "website": company_data.website,
            "password": company_data.password
        })
        
        org_id = result.scalar()
        await db.commit()
        
        # Return the company information
        return {
            "org_id": org_id,
            "org_name": company_data.name,
            "org_email": company_data.email
        }
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to register company: {str(e)}"
        )


# from fastapi import APIRouter, Depends, HTTPException, status
# from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
# from sqlalchemy.ext.asyncio import AsyncSession
# from sqlalchemy import text
# from pydantic import BaseModel, EmailStr, Field
# from typing import Optional
# import hashlib
# import secrets
# import datetime
# from app.db import get_db

# router = APIRouter(prefix="/auth", tags=["authentication"])

# # Models
# class UserCreate(BaseModel):
#     email: EmailStr
#     password: str = Field(..., min_length=6)
#     name: str
#     phone: Optional[str] = None

# class UserLogin(BaseModel):
#     email: EmailStr
#     password: str

# class Token(BaseModel):
#     access_token: str
#     token_type: str = "bearer"
#     user_id: int
#     name: str
#     email: str

# # Password hashing
# def hash_password(password: str, salt: Optional[str] = None):
#     if not salt:
#         salt = secrets.token_hex(16)
#     pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()
#     return f"{salt}${pw_hash}"

# def verify_password(stored_password: str, provided_password: str):
#     salt = stored_password.split('$')[0]
#     return stored_password == hash_password(provided_password, salt)

# # Routes
# @router.post("/register", response_model=Token)
# async def register_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
#     # Check if user exists
#     existing = await db.execute(text(
#         "SELECT email FROM student WHERE email = :email"
#     ), {"email": user.email})
    
#     if existing.scalar():
#         raise HTTPException(
#             status_code=status.HTTP_400_BAD_REQUEST,
#             detail="Email already registered"
#         )
    
#     # Hash password
#     hashed_password = hash_password(user.password)
    
#     # Create auth entry
#     auth_result = await db.execute(text("""
#         INSERT INTO user_auth (email, password_hash, is_active) 
#         VALUES (:email, :password, 1)
#     """), {"email": user.email, "password": hashed_password})
    
#     auth_id = auth_result.lastrowid
    
#     # Create student entry
#     student_result = await db.execute(text("""
#         INSERT INTO student (
#             name, email, phone, category_code, disability_code
#         ) VALUES (
#             :name, :email, :phone, 'GEN', 'NONE'
#         )
#     """), {
#         "name": user.name,
#         "email": user.email,
#         "phone": user.phone,
#     })
    
#     student_id = student_result.lastrowid
    
#     # Create session token
#     token = secrets.token_hex(32)
    
#     # Store session
#     expires = datetime.datetime.now() + datetime.timedelta(days=30)
#     await db.execute(text("""
#         INSERT INTO user_session (user_id, token, expires_at)
#         VALUES (:user_id, :token, :expires)
#     """), {"user_id": auth_id, "token": token, "expires": expires})
    
#     await db.commit()
    
#     return Token(
#         access_token=token,
#         user_id=student_id,
#         name=user.name,
#         email=user.email
#     )

# @router.post("/login", response_model=Token)
# async def login(form_data: UserLogin, db: AsyncSession = Depends(get_db)):
#     # Get user
#     user = await db.execute(text("""
#         SELECT ua.id, ua.email, ua.password_hash, s.student_id, s.name
#         FROM user_auth ua
#         JOIN student s ON s.email = ua.email
#         WHERE ua.email = :email AND ua.is_active = 1
#     """), {"email": form_data.email})
    
#     user = user.mappings().first()
    
#     if not user or not verify_password(user["password_hash"], form_data.password):
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid credentials",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     # Create session token
#     token = secrets.token_hex(32)
    
#     # Store session
#     expires = datetime.datetime.now() + datetime.timedelta(days=30)
#     await db.execute(text("""
#         INSERT INTO user_session (user_id, token, expires_at)
#         VALUES (:user_id, :token, :expires)
#     """), {"user_id": user["id"], "token": token, "expires": expires})
    
#     await db.commit()
    
#     return Token(
#         access_token=token,
#         user_id=user["student_id"],
#         name=user["name"],
#         email=user["email"]
#     )

# @router.get("/me", response_model=dict)
# async def get_current_user(token: str, db: AsyncSession = Depends(get_db)):
#     # Verify token
#     user = await db.execute(text("""
#         SELECT ua.id, ua.email, s.student_id, s.name
#         FROM user_session us
#         JOIN user_auth ua ON ua.id = us.user_id
#         JOIN student s ON s.email = ua.email
#         WHERE us.token = :token AND us.expires_at > NOW() AND ua.is_active = 1
#     """), {"token": token})
    
#     user = user.mappings().first()
    
#     if not user:
#         raise HTTPException(
#             status_code=status.HTTP_401_UNAUTHORIZED,
#             detail="Invalid or expired token",
#             headers={"WWW-Authenticate": "Bearer"},
#         )
    
#     return {
#         "user_id": user["student_id"],
#         "name": user["name"],
#         "email": user["email"]
#     }

# @router.post("/logout")
# async def logout(token: str, db: AsyncSession = Depends(get_db)):
#     await db.execute(text("""
#         DELETE FROM user_session WHERE token = :token
#     """), {"token": token})
    
#     await db.commit()
    
#     return {"message": "Successfully logged out"}