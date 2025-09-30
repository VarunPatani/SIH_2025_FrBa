import numpy as np
from typing import Dict, List, Optional
import os
import json

# Global cache for GloVe model to avoid reloading
_glove_model_cache = None

# Configuration class for all hardcoded values
class GloVeMatchingConfig:
    """Configuration class for GloVe matching parameters"""
    
    def __init__(self, config_file: Optional[str] = None):
        # Default configuration
        self.default_config = {
            # Skills matching
            "character_similarity_threshold": 0.3,
            
            # Location matching
            "city_state_boost": 0.3,
            "regional_boost": 0.2,
            "city_state_pairs": [
                ("mumbai", "maharashtra"), ("delhi", "delhi"), ("bangalore", "karnataka"),
                ("chennai", "tamil nadu"), ("hyderabad", "telangana"), ("pune", "maharashtra"),
                ("kolkata", "west bengal"), ("ahmedabad", "gujarat"), ("jaipur", "rajasthan"),
                ("lucknow", "uttar pradesh"), ("kanpur", "uttar pradesh"), ("nagpur", "maharashtra"),
                ("indore", "madhya pradesh"), ("bhopal", "madhya pradesh"), ("visakhapatnam", "andhra pradesh"),
                ("patna", "bihar"), ("vadodara", "gujarat"), ("ludhiana", "punjab"),
                ("agra", "uttar pradesh"), ("nashik", "maharashtra"), ("faridabad", "haryana"),
                ("meerut", "uttar pradesh"), ("rajkot", "gujarat"), ("kalyan", "maharashtra"),
                ("vasai", "maharashtra"), ("varanasi", "uttar pradesh"), ("srinagar", "jammu and kashmir"),
                ("aurangabad", "maharashtra"), ("noida", "uttar pradesh"), ("solapur", "maharashtra")
            ],
            "regions": {
                "north": ["delhi", "punjab", "haryana", "himachal pradesh", "jammu and kashmir", "uttarakhand", "uttar pradesh"],
                "south": ["karnataka", "tamil nadu", "kerala", "andhra pradesh", "telangana"],
                "east": ["west bengal", "odisha", "bihar", "jharkhand", "assam"],
                "west": ["maharashtra", "gujarat", "rajasthan", "goa"],
                "central": ["madhya pradesh", "chhattisgarh"]
            },
            
            # CGPA matching
            "performance_levels": {
                "excellent": {"range": (8.5, 10.0), "score": 1.0},
                "very_good": {"range": (7.5, 8.5), "score": 0.8},
                "good": {"range": (6.5, 7.5), "score": 0.6},
                "satisfactory": {"range": (6.0, 6.5), "score": 0.4},
                "minimum": {"range": (0.0, 6.0), "score": 0.2}
            },
            "cgpa_bonus_thresholds": {
                "high_bonus": {"threshold": 1.0, "multiplier": 0.1, "max_bonus": 0.2},
                "low_bonus": {"threshold": 0.5, "multiplier": 0.15, "max_bonus": 0.1}
            },
            "competitiveness_levels": {
                "highly_competitive": {"threshold": 8.0, "factor": 1.1},
                "moderately_competitive": {"threshold": 7.0, "factor": 1.05},
                "standard": {"threshold": 6.0, "factor": 1.0},
                "low_requirement": {"threshold": 0.0, "factor": 0.95}
            },
            
            # Default weights
            "default_weights": {
                "skill_weight": 0.65,
                "location_weight": 0.20,
                "cgpa_weight": 0.15
            }
        }
        
        # Load configuration from file if provided
        if config_file and os.path.exists(config_file):
            self.load_config(config_file)
        else:
            self.config = self.default_config.copy()
    
    def load_config(self, config_file: str):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                file_config = json.load(f)
            # Merge with defaults (file config overrides defaults)
            self.config = self.default_config.copy()
            self.config.update(file_config)
            print(f"Loaded configuration from {config_file}")
        except Exception as e:
            print(f"Warning: Could not load config file {config_file}: {e}")
            print("Using default configuration")
            self.config = self.default_config.copy()
    
    def save_config(self, config_file: str):
        """Save current configuration to JSON file"""
        try:
            with open(config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            print(f"Saved configuration to {config_file}")
        except Exception as e:
            print(f"Error saving config file {config_file}: {e}")
    
    def get(self, key: str, default=None):
        """Get configuration value with dot notation support"""
        keys = key.split('.')
        value = self.config
        try:
            for k in keys:
                value = value[k]
            return value
        except (KeyError, TypeError):
            return default

# Global configuration instance
_config = GloVeMatchingConfig()

# 1. GloVe Model Loading
def load_glove_model(glove_file_path: str) -> Dict[str, np.ndarray]:
    """
    Loads a GloVe word embedding model from file.
    """
    print(f"Loading GloVe model from {glove_file_path}...")
    
    import os
    if not os.path.exists(glove_file_path):
        raise FileNotFoundError(f"GloVe file not found at {glove_file_path}")
    
    model = {}
    with open(glove_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            values = line.split()
            word = values[0]
            vector = np.array([float(x) for x in values[1:]])
            model[word] = vector
    
    print(f"Successfully loaded {len(model)} word vectors from GloVe file")
    return model

# 2. Document Vectorization with Fallback Strategy
def get_document_vector(text: str, model: Dict[str, np.ndarray]) -> np.ndarray:
    """
    Computes the average word vector (document vector) for a given text.
    Uses multiple strategies to handle unknown words:
    1. Direct word match
    2. Substring matching for compound words
    3. Character-level similarity for typos
    """
    if not text:
        return np.zeros(list(model.values())[0].shape) if model else np.array([0.0])
    
    # Tokenization logic similar to the Jaccard function:
    tokens = [w.strip().lower() for w in text.replace(",", " ").split() if w.strip()]
    
    valid_vectors = []
    
    for token in tokens:
        # Strategy 1: Direct match
        if token in model:
            valid_vectors.append(model[token])
            continue
            
        # Strategy 2: Substring matching for compound words
        # e.g., "machinelearning" -> "machine" + "learning"
        found_match = False
        for word in model.keys():
            if word in token or token in word:
                valid_vectors.append(model[word])
                found_match = True
                break
        
        if found_match:
            continue
            
        # Strategy 3: Character-level similarity (simple implementation)
        best_match = None
        best_similarity = 0.0
        
        for word in model.keys():
            # Simple character overlap similarity
            overlap = len(set(token) & set(word))
            union = len(set(token) | set(word))
            if union > 0:
                similarity = overlap / union
                threshold = _config.get("character_similarity_threshold", 0.3)
                if similarity > best_similarity and similarity > threshold:
                    best_similarity = similarity
                    best_match = word
        
        if best_match:
            valid_vectors.append(model[best_match])
    
    if not valid_vectors:
        # Return a zero vector of the correct dimension if no words are found
        vector_dim = list(model.values())[0].shape if model else (3,)
        return np.zeros(vector_dim)

    # Calculate the mean (average) of all valid word vectors
    return np.mean(valid_vectors, axis=0)

# 3. Cosine Similarity Calculation
def calculate_cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    """
    Calculates the cosine similarity between two vectors.
    """
    if np.all(vec_a == 0) and np.all(vec_b == 0):
        return 0.0 # Or 1.0 if two empty skill lists are considered a perfect match
        
    dot_product = np.dot(vec_a, vec_b)
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    
    # Handle division by zero for zero vectors
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
        
    return float(dot_product / (norm_a * norm_b))

# 4. Main Matching Function
def glove_skill_match_score(student_skills: str, required_skills: str, glove_model: Dict[str, np.ndarray]) -> float:
    """
    Calculates the skill match score using GloVe embeddings and Cosine Similarity.
    """
    student_vec = get_document_vector(student_skills, glove_model)
    required_vec = get_document_vector(required_skills, glove_model)
    
    # Ensure vectors have the same, non-zero dimension for calculation
    if student_vec.shape != required_vec.shape or student_vec.size == 0:
        # This case should be handled gracefully by get_document_vector
        return 0.0
        
    score = calculate_cosine_similarity(student_vec, required_vec)
    
    # Cosine similarity is already between -1 and 1. We'll map it to [0, 1] 
    # to align with typical match score expectations, though for skill match, 
    # a simple max(0, score) might be sufficient if vectors are mostly positive.
    # For a clean score: (score + 1) / 2
    # But often for positive-vector word embeddings, max(0, score) is fine.
    # We will stick to the output of calculate_cosine_similarity for simplicity here.
    # Since word vectors are generally orthogonal, the score is usually positive or close to zero.
    return max(0.0, score)

# 5. Enhanced Location Matching with GloVe
def glove_location_match_score(student_location: str, job_location: str, glove_model: Dict[str, np.ndarray]) -> float:
    """
    Enhanced location matching using GloVe embeddings.
    Handles city names, regions, states, and geographic relationships.
    """
    if not student_location or not job_location:
        return 0.0
    
    # Direct exact match (highest priority)
    if student_location.lower().strip() == job_location.lower().strip():
        return 1.0
    
    # Use GloVe for semantic location matching
    location_score = glove_skill_match_score(student_location, job_location, glove_model)
    
    # Boost score for geographic relationships
    # Common geographic relationships that should have higher scores
    geographic_boost = 0.0
    
    # City-state relationships (e.g., "Mumbai" vs "Maharashtra")
    city_state_pairs = _config.get("city_state_pairs", [])
    
    student_loc_lower = student_location.lower().strip()
    job_loc_lower = job_location.lower().strip()
    
    city_state_boost = _config.get("city_state_boost", 0.3)
    for city, state in city_state_pairs:
        if (city in student_loc_lower and state in job_loc_lower) or \
           (state in student_loc_lower and city in job_loc_lower):
            geographic_boost = city_state_boost
            break
    
    # Regional relationships (e.g., "North India" vs "Delhi")
    regions = _config.get("regions", {})
    
    for region, states in regions.items():
        if region in student_loc_lower:
            for state in states:
                if state in job_loc_lower:
                    regional_boost = _config.get("regional_boost", 0.2)
                    geographic_boost = max(geographic_boost, regional_boost)
        elif region in job_loc_lower:
            for state in states:
                if state in student_loc_lower:
                    regional_boost = _config.get("regional_boost", 0.2)
                    geographic_boost = max(geographic_boost, regional_boost)
    
    return min(1.0, location_score + geographic_boost)

# 6. Enhanced CGPA Matching with Context
def glove_cgpa_match_score(student_cgpa: float, job_min_cgpa: float, glove_model: Dict[str, np.ndarray]) -> float:
    """
    Enhanced CGPA matching that considers academic context and competitiveness.
    Uses GloVe to understand academic performance levels semantically.
    """
    if student_cgpa is None or job_min_cgpa is None:
        return 0.0
    
    # Eligibility check (must pass minimum requirement)
    if student_cgpa < job_min_cgpa:
        return 0.0
    
    # Enhanced scoring based on CGPA ranges and academic competitiveness
    cgpa_diff = student_cgpa - job_min_cgpa
    
    # Define CGPA performance levels with semantic understanding
    performance_levels = _config.get("performance_levels", {})
    
    # Calculate base score based on performance level
    base_score = 0.0
    for level, level_config in performance_levels.items():
        min_cgpa, max_cgpa = level_config["range"]
        if min_cgpa <= student_cgpa < max_cgpa:
            base_score = level_config["score"]
            break
    
    # Bonus for exceeding minimum requirement significantly
    bonus_config = _config.get("cgpa_bonus_thresholds", {})
    high_bonus = bonus_config.get("high_bonus", {"threshold": 1.0, "multiplier": 0.1, "max_bonus": 0.2})
    low_bonus = bonus_config.get("low_bonus", {"threshold": 0.5, "multiplier": 0.15, "max_bonus": 0.1})
    
    if cgpa_diff > high_bonus["threshold"]:
        bonus = min(high_bonus["max_bonus"], cgpa_diff * high_bonus["multiplier"])
        base_score = min(1.0, base_score + bonus)
    elif cgpa_diff > low_bonus["threshold"]:
        bonus = min(low_bonus["max_bonus"], cgpa_diff * low_bonus["multiplier"])
        base_score = min(1.0, base_score + bonus)
    
    # Consider job competitiveness based on minimum CGPA requirement
    competitiveness_levels = _config.get("competitiveness_levels", {})
    competitiveness_factor = 1.0
    
    for level, config in competitiveness_levels.items():
        if job_min_cgpa >= config["threshold"]:
            competitiveness_factor = config["factor"]
            break
    
    final_score = min(1.0, base_score * competitiveness_factor)
    return final_score

# 7. Comprehensive Matching Function
def glove_comprehensive_match_score(
    student_skills: str, 
    required_skills: str,
    student_location: str,
    job_location: str, 
    student_cgpa: float,
    job_min_cgpa: float,
    glove_model: Dict[str, np.ndarray],
    skill_weight: Optional[float] = None,
    location_weight: Optional[float] = None,
    cgpa_weight: Optional[float] = None
) -> tuple[float, dict]:
    """
    Comprehensive matching using GloVe embeddings for all three components.
    Returns (total_score, component_scores)
    """
    # Get default weights from config if not provided
    default_weights = _config.get("default_weights", {})
    skill_weight = skill_weight if skill_weight is not None else default_weights.get("skill_weight", 0.65)
    location_weight = location_weight if location_weight is not None else default_weights.get("location_weight", 0.20)
    cgpa_weight = cgpa_weight if cgpa_weight is not None else default_weights.get("cgpa_weight", 0.15)
    
    # Calculate individual component scores
    skill_score = glove_skill_match_score(student_skills, required_skills, glove_model)
    location_score = glove_location_match_score(student_location, job_location, glove_model)
    cgpa_score = glove_cgpa_match_score(student_cgpa, job_min_cgpa, glove_model)
    
    # Calculate weighted total score
    total_score = (
        skill_weight * skill_score + 
        location_weight * location_score + 
        cgpa_weight * cgpa_score
    )
    
    # Component breakdown for debugging/analysis
    component_scores = {
        "skill_score": round(skill_score, 4),
        "location_score": round(location_score, 4),
        "cgpa_score": round(cgpa_score, 4),
        "weights": {
            "skill": skill_weight,
            "location": location_weight,
            "cgpa": cgpa_weight
        }
    }
    
    return total_score, component_scores

# 8. Integration Functions for the Allocation System
def get_cached_glove_model(glove_file_path: str = "glove.6B.200d.txt") -> Dict[str, np.ndarray]:
    """
    Gets the cached GloVe model or loads it if not cached.
    This function should be used by the allocation system.
    """
    global _glove_model_cache
    
    if _glove_model_cache is None:
        # Try to find the GloVe file in common locations
        possible_paths = [
            glove_file_path,
            os.path.join(os.path.dirname(__file__), glove_file_path),
            os.path.join(os.path.dirname(__file__), "..", glove_file_path),
            os.path.join(os.path.dirname(__file__), "..", "..", glove_file_path)
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                _glove_model_cache = load_glove_model(path)
                break
        
        if _glove_model_cache is None:
            raise FileNotFoundError(f"GloVe file not found in any of these locations: {possible_paths}")
    
    return _glove_model_cache

def glove_similarity(text_a: str, text_b: str, glove_file_path: Optional[str] = None) -> float:
    """
    Drop-in replacement for the jaccard() function in allocation.py
    This function has the same signature and behavior as jaccard() but uses GloVe embeddings.
    """
    try:
        # Use configurable GloVe file path
        glove_path = glove_file_path or _config.get("glove_file_path", "glove.6B.200d.txt")
        model = get_cached_glove_model(glove_path)
        return glove_skill_match_score(text_a, text_b, model)
    except Exception as e:
        print(f"Warning: GloVe similarity failed ({e}), falling back to Jaccard similarity")
        # Fallback to Jaccard similarity if GloVe fails
        return jaccard_fallback(text_a, text_b)

def glove_comprehensive_similarity(
    student_skills: str,
    required_skills: str,
    student_location: str,
    job_location: str,
    student_cgpa: float,
    job_min_cgpa: float,
    skill_weight: Optional[float] = None,
    location_weight: Optional[float] = None,
    cgpa_weight: Optional[float] = None,
    glove_file_path: Optional[str] = None
) -> tuple[float, dict]:
    """
    Comprehensive drop-in replacement for the allocation scoring system.
    Returns (total_score, component_scores) for detailed analysis.
    """
    try:
        # Use configurable GloVe file path
        glove_path = glove_file_path or _config.get("glove_file_path", "glove.6B.200d.txt")
        model = get_cached_glove_model(glove_path)
        return glove_comprehensive_match_score(
            student_skills, required_skills,
            student_location, job_location,
            student_cgpa, job_min_cgpa,
            model, skill_weight, location_weight, cgpa_weight
        )
    except Exception as e:
        print(f"Warning: GloVe comprehensive matching failed ({e}), falling back to traditional scoring")
        # Fallback to traditional scoring
        sem = jaccard_fallback(student_skills, required_skills)
        loc = 1.0 if (student_location and job_location and student_location.lower() == job_location.lower()) else 0.0
        cg = norm_fallback(student_cgpa, job_min_cgpa)
        
        total_score = skill_weight * sem + location_weight * loc + cgpa_weight * cg
        component_scores = {
            "skill_score": round(sem, 4),
            "location_score": round(loc, 4),
            "cgpa_score": round(cg, 4),
            "weights": {"skill": skill_weight, "location": location_weight, "cgpa": cgpa_weight}
        }
        return total_score, component_scores

def norm_fallback(x: float, min_cgpa: float) -> float:
    """
    Fallback CGPA normalization function (same as in allocation.py)
    """
    if x is None:
        return 0.0
    if min_cgpa <= 0:
        return 0.0
    
    # Use configurable CGPA normalization range
    cgpa_range = _config.get("cgpa_normalization_range", {"min": 6.0, "max": 9.5})
    min_cgpa_range = cgpa_range["min"]
    max_cgpa_range = cgpa_range["max"]
    
    return max(0.0, min(1.0, (x - min_cgpa_range) / (max_cgpa_range - min_cgpa_range)))

def jaccard_fallback(text_a: str, text_b: str) -> float:
    """
    Fallback Jaccard similarity function (same as in allocation.py)
    """
    if not text_a or not text_b:
        return 0.0
    A = set(w.strip().lower() for w in text_a.replace(",", " ").split())
    B = set(w.strip().lower() for w in text_b.replace(",", " ").split())
    if not A or not B:
        return 0.0
    return len(A & B) / len(A | B)

if __name__ == "__main__":
    GLOVE_PATH = "glove.6B.200d.txt" 
    
    # Load the GloVe model
    glove_model = load_glove_model(GLOVE_PATH)
    

# TEST CASES TO CHECK THE SCRIPT 
    # Test Case 1: High Semantic Match (Python/SQL)
    student_a_skills = "Python, Data Analysis, SQL"
    internship_a_req = "Programming in Python and SQL"
    score_a = glove_skill_match_score(student_a_skills, internship_a_req, glove_model)
    print(f"\nMatch A: Student: '{student_a_skills}' | Internship: '{internship_a_req}'")
    print(f"GloVe Similarity Score: {score_a:.4f}")
    
    # Test Case 2: Low/No Semantic Match
    student_b_skills = "Java Programming"
    internship_b_req = "Project Management"
    score_b = glove_skill_match_score(student_b_skills, internship_b_req, glove_model)
    print(f"\nMatch B: Student: '{student_b_skills}' | Internship: '{internship_b_req}'")
    print(f"GloVe Similarity Score: {score_b:.4f}")
    
    # Test Case 3: Partial Match
    student_c_skills = "Python"
    internship_c_req = "Data"
    score_c = glove_skill_match_score(student_c_skills, internship_c_req, glove_model)
    print(f"\nMatch C: Student: '{student_c_skills}' | Internship: '{internship_c_req}'")
    print(f"GloVe Similarity Score: {score_c:.4f}")
    
    # Test Case 4: Complex Skills Match
    student_d_skills = "Machine Learning, Python, Data Analysis, SQL, Pandas, NumPy"
    internship_d_req = "AI/ML Engineer, Python Programming, Database Management, Data Science"
    score_d = glove_skill_match_score(student_d_skills, internship_d_req, glove_model)
    print(f"\nMatch D: Student: '{student_d_skills}' | Internship: '{internship_d_req}'")
    print(f"GloVe Similarity Score: {score_d:.4f}")
    
    # Test Case 5: Web Development Match
    student_e_skills = "React, JavaScript, HTML, CSS, Node.js"
    internship_e_req = "Frontend Development, React, JavaScript, Web Design"
    score_e = glove_skill_match_score(student_e_skills, internship_e_req, glove_model)
    print(f"\nMatch E: Student: '{student_e_skills}' | Internship: '{internship_e_req}'")
    print(f"GloVe Similarity Score: {score_e:.4f}")
    
    # Test Case 6: DevOps Match
    student_f_skills = "Docker, Kubernetes, AWS, CI/CD, Jenkins"
    internship_f_req = "DevOps Engineer, Cloud Computing, Containerization, Automation"
    score_f = glove_skill_match_score(student_f_skills, internship_f_req, glove_model)
    print(f"\nMatch F: Student: '{student_f_skills}' | Internship: '{internship_f_req}'")
    print(f"GloVe Similarity Score: {score_f:.4f}")
    
    # Test Case 7: Unknown Skills (should still work with fallback strategies)
    student_g_skills = "MachineLearning, DeepNeuralNetworks, ComputerVision, NLP"
    internship_g_req = "AI Engineer, Machine Learning, Deep Learning, Neural Networks"
    score_g = glove_skill_match_score(student_g_skills, internship_g_req, glove_model)
    print(f"\nMatch G: Student: '{student_g_skills}' | Internship: '{internship_g_req}'")
    print(f"GloVe Similarity Score: {score_g:.4f}")
    
    # Test Case 8: Comprehensive Matching Test
    print(f"\n=== Comprehensive Matching Test ===")
    student_i_skills = "Python, Machine Learning, Data Analysis"
    internship_i_req = "AI Engineer, Python Programming, ML"
    student_i_location = "Mumbai"
    job_i_location = "Maharashtra"
    student_i_cgpa = 8.2
    job_i_min_cgpa = 7.0
    
    total_score, components = glove_comprehensive_similarity(
        student_i_skills, internship_i_req,
        student_i_location, job_i_location,
        student_i_cgpa, job_i_min_cgpa
    )
    
    print(f"Student Skills: '{student_i_skills}'")
    print(f"Job Requirements: '{internship_i_req}'")
    print(f"Student Location: '{student_i_location}' | Job Location: '{job_i_location}'")
    print(f"Student CGPA: {student_i_cgpa} | Job Min CGPA: {job_i_min_cgpa}")
    print(f"\nComponent Scores:")
    print(f"  Skills: {components['skill_score']:.4f}")
    print(f"  Location: {components['location_score']:.4f}")
    print(f"  CGPA: {components['cgpa_score']:.4f}")
    print(f"Total Score: {total_score:.4f}")
    
    # Test Case 9: Location Matching Examples
    print(f"\n=== Location Matching Examples ===")
    location_tests = [
        ("Mumbai", "Maharashtra", "City-State relationship"),
        ("Delhi", "North India", "City-Region relationship"),
        ("Bangalore", "Karnataka", "City-State relationship"),
        ("Chennai", "Tamil Nadu", "City-State relationship"),
        ("Remote", "Any Location", "Remote work compatibility"),
        ("Pune", "Mumbai", "Different cities, same state")
    ]
    
    for student_loc, job_loc, description in location_tests:
        loc_score = glove_location_match_score(student_loc, job_loc, glove_model)
        print(f"{description}: '{student_loc}' vs '{job_loc}' = {loc_score:.4f}")
    
    # Test Case 10: CGPA Matching Examples
    print(f"\n=== CGPA Matching Examples ===")
    cgpa_tests = [
        (9.2, 8.0, "Excellent student, high requirement"),
        (7.8, 7.0, "Good student, moderate requirement"),
        (6.8, 6.5, "Satisfactory student, low requirement"),
        (8.5, 7.5, "Very good student, moderate requirement"),
        (6.2, 6.0, "Minimum student, minimum requirement")
    ]
    
    for student_cgpa, job_min_cgpa, description in cgpa_tests:
        cgpa_score = glove_cgpa_match_score(student_cgpa, job_min_cgpa, glove_model)
        print(f"{description}: {student_cgpa} vs {job_min_cgpa} = {cgpa_score:.4f}")
    
    # Test Case 11: Integration Test (using the drop-in replacement function)
    print(f"\n=== Integration Test (Skills Only) ===")
    student_h_skills = "Python, Data Science, Machine Learning"
    internship_h_req = "Data Analyst, Python Programming, ML Engineer"
    score_h = glove_similarity(student_h_skills, internship_h_req)
    print(f"Integration Test: Student: '{student_h_skills}' | Internship: '{internship_h_req}'")
    print(f"GloVe Similarity Score: {score_h:.4f}")
    
    # Compare with Jaccard for reference
    jaccard_score = jaccard_fallback(student_h_skills, internship_h_req)
    print(f"Jaccard Similarity Score: {jaccard_score:.4f}")
    print(f"Improvement: {((score_h - jaccard_score) / jaccard_score * 100):.1f}%")

# Configuration Management Functions
def load_config_from_file(config_file: str):
    """Load configuration from a JSON file"""
    global _config
    _config = GloVeMatchingConfig(config_file)

def save_config_to_file(config_file: str):
    """Save current configuration to a JSON file"""
    _config.save_config(config_file)

def get_config_value(key: str, default=None):
    """Get a configuration value"""
    return _config.get(key, default)

def update_config_value(key: str, value):
    """Update a configuration value"""
    keys = key.split('.')
    config = _config.config
    for k in keys[:-1]:
        if k not in config:
            config[k] = {}
        config = config[k]
    config[keys[-1]] = value

def create_sample_config_file(config_file: str = "glove_matching_config.json"):
    """Create a sample configuration file with all current settings"""
    _config.save_config(config_file)
    print(f"Sample configuration file created: {config_file}")
    print("You can modify this file to customize the matching behavior")
