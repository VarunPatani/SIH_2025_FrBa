# Integration Guide for Comprehensive GloVe-based Matching

## How to Integrate with the Existing Code

### Option 1: Comprehensive Matching (Recommended)

Replace the entire scoring section in `allocation.py` lines 166-170:

**Current code:**
```python
sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
cg = norm(float(s["cgpa"]) if s["cgpa"] is not None else 0.0, 6.0, 9.5) if j["min_cgpa"] > 0 else 0.0
loc = 1.0 if (s["location_pref"] and j["location"] and s["location_pref"].lower() == j["location"].lower()) else 0.0

score = skill_weight * sem + location_weight * loc + cgpa_weight * cg
```

**New code:**
```python
from app.nlp_matching_glove import glove_comprehensive_similarity

total_score, components = glove_comprehensive_similarity(
    s["skills_text"] or "",
    j["req_skills_text"],
    s["location_pref"] or "",
    j["location"] or "",
    float(s["cgpa"]) if s["cgpa"] is not None else 0.0,
    j["min_cgpa"],
    skill_weight, location_weight, cgpa_weight
)

score = total_score
```

### Option 2: Skills-Only Enhancement

Replace just the `jaccard()` function call in `allocation.py` line 166:

**Current code:**
```python
sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
```

**New code:**
```python
from app.nlp_matching_glove import glove_similarity
sem = glove_similarity(s["skills_text"] or "", j["req_skills_text"])
```

### Option 2: Configuration-based Switching

Add a configuration option to choose between Jaccard and GloVe:

```python
# In allocation.py, add this import at the top
from app.nlp_matching_glove import glove_similarity, jaccard_fallback

# In the run_allocation function, add a parameter
async def run_allocation(
    db: AsyncSession,
    scope_emails: Optional[List[str]] = None,
    respect_existing: bool = True,
    skill_weight: float = 0.65,
    location_weight: float = 0.20,
    cgpa_weight: float = 0.15,
    use_glove: bool = True,  # New parameter
):

# Then in the scoring section (around line 166):
if use_glove:
    sem = glove_similarity(s["skills_text"] or "", j["req_skills_text"])
else:
    sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
```

### Option 3: Environment Variable Control

```python
import os
from app.nlp_matching_glove import glove_similarity, jaccard_fallback

# Use GloVe if available, otherwise fall back to Jaccard
USE_GLOVE = os.getenv("USE_GLOVE_MATCHING", "true").lower() == "true"

# In the scoring section:
if USE_GLOVE:
    sem = glove_similarity(s["skills_text"] or "", j["req_skills_text"])
else:
    sem = jaccard(s["skills_text"] or "", j["req_skills_text"])
```

## Key Benefits of This Integration

### Skills Matching
1. **Semantic Understanding**: "Machine Learning" matches "AI", "ML", "Deep Learning"
2. **Unknown Skills**: Handles new technologies and typos
3. **Compound Words**: "MachineLearning" → "Machine" + "Learning"
4. **Multiple Strategies**: Direct match → Substring → Character similarity

### Location Matching  
1. **Geographic Relationships**: "Mumbai" matches "Maharashtra"
2. **Regional Understanding**: "Delhi" matches "North India"
3. **City-State Pairs**: Comprehensive Indian city-state mapping
4. **Semantic Similarity**: Uses GloVe for location name variations

### CGPA Matching
1. **Performance Levels**: Excellent (8.5+), Very Good (7.5+), Good (6.5+)
2. **Competitiveness Factor**: Higher scores for competitive positions
3. **Bonus System**: Extra points for exceeding requirements significantly
4. **Context Awareness**: Considers job requirements vs student performance

### System Benefits
1. **Comprehensive Scoring**: All three components use semantic understanding
2. **Automatic Fallback**: Falls back to traditional methods if GloVe fails
3. **Caching**: GloVe model loads once and stays in memory
4. **Detailed Analysis**: Returns component scores for debugging
5. **No Breaking Changes**: Existing code continues to work

## Configuration System

### No More Hardcoded Values! ✅

All previously hardcoded values are now configurable through a JSON configuration file:

**Configuration File**: `glove_matching_config.json`

### Key Configurable Parameters:

#### **Skills Matching**
- `character_similarity_threshold`: Threshold for typo detection (default: 0.3)

#### **Location Matching**  
- `city_state_boost`: Score boost for city-state relationships (default: 0.3)
- `regional_boost`: Score boost for regional relationships (default: 0.2)
- `city_state_pairs`: List of city-state mappings (30+ Indian cities)
- `regions`: Regional groupings (North/South/East/West/Central India)

#### **CGPA Matching**
- `performance_levels`: CGPA ranges and corresponding scores
- `cgpa_bonus_thresholds`: Bonus calculation parameters
- `competitiveness_levels`: Job competitiveness factors

#### **Default Weights**
- `default_weights`: skill_weight, location_weight, cgpa_weight

### Using Configuration:

```python
# Load custom configuration
from app.nlp_matching_glove import load_config_from_file
load_config_from_file("custom_config.json")

# Or use default configuration (no file needed)
# The system automatically uses sensible defaults
```

### Customizing Configuration:

1. **Copy the sample config**: `glove_matching_config.json`
2. **Modify values** as needed
3. **Load in your code**: `load_config_from_file("your_config.json")`

## File Placement

Place your `glove.6B.200d.txt` file in:
- `/Users/harshil/Desktop/SIH_2025_FrBa/backend/glove.6B.200d.txt` (recommended)
- Or any location and update the path in the function calls

## Testing the Integration

1. Place the GloVe file in the backend directory
2. Run: `python app/nlp_matching_glove.py` to test the module
3. Modify `allocation.py` as shown above
4. Run the allocation system to see improved matching

## Performance Considerations

- **First Load**: ~2-3 seconds to load GloVe model (400K words)
- **Subsequent Calls**: Instant (cached)
- **Memory Usage**: ~400MB for glove.6B.200d.txt
- **Fallback**: Automatic if GloVe file not found
