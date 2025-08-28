# Marine Species Collected Filter

## Overview

The Reefey backend now includes a collected filter for the marine species endpoint (`/api/marine`), allowing users to filter the marine species list to show only species they have collected or only species they haven't collected yet.

## Features

### 1. Collected Filter Options

- **Show all species**: Default behavior (no filter applied)
- **Show only collected species**: Filter to show only species the user has collected
- **Show only non-collected species**: Filter to show only species the user hasn't collected yet

### 2. Device-Specific Filtering

- **Device ID required**: The collected filter requires a `deviceId` parameter
- **User-specific results**: Each user sees their own collection status
- **Real-time updates**: Results update as users collect new species

## API Usage

### Endpoint: `GET /api/marine`

### Query Parameters

#### New Parameters for Collected Filter

- **`collected`** (boolean, optional): 
  - `true`: Show only collected species
  - `false`: Show only non-collected species
  - `undefined` or not provided: Show all species (default)

- **`deviceId`** (string, required when using collected filter):
  - Device identifier for the user
  - Required when `collected` parameter is provided

#### Existing Parameters (unchanged)

- `q`: Text search
- `rarity`: Filter by rarity (1-5)
- `category`: Filter by category (Fishes, Creatures, Corals)
- `habitat`: Filter by habitat type
- `diet`: Filter by diet type
- `behavior`: Filter by behavior type
- `sizeMin`: Minimum size in cm
- `sizeMax`: Maximum size in cm
- `danger`: Filter by danger level
- `venomous`: Filter by venomous status
- `edibility`: Filter by edibility status
- `poisonous`: Filter by poisonous status
- `endangeredd`: Filter by endangered status
- `sort`: Sort order (now includes 'collected')
- `page`: Page number for pagination
- `size`: Number of results per page

## Usage Examples

### 1. Show All Marine Species (Default)

```bash
GET /api/marine
```

**Response**: All marine species in the database

### 2. Show Only Collected Species

```bash
GET /api/marine?collected=true&deviceId=user123
```

**Response**: Only species that the user with deviceId "user123" has collected

### 3. Show Only Non-Collected Species

```bash
GET /api/marine?collected=false&deviceId=user123
```

**Response**: Only species that the user with deviceId "user123" hasn't collected yet

### 4. Combine with Other Filters

```bash
GET /api/marine?collected=true&deviceId=user123&category=Fishes&rarity=4
```

**Response**: Only collected fish species with rarity level 4

### 5. Sort by Collection Status

```bash
GET /api/marine?deviceId=user123&sort=collected
```

**Response**: All species sorted by collection status (collected first, then non-collected)

## Implementation Details

### Database Query Logic

#### For Collected Species (`collected=true`)

```sql
SELECT * FROM marine 
INNER JOIN collections ON marine.id = collections.marine_id 
WHERE collections.device_id = 'user123'
```

#### For Non-Collected Species (`collected=false`)

```sql
SELECT * FROM marine 
WHERE id NOT IN (
  SELECT marine_id FROM collections WHERE device_id = 'user123'
)
```

#### For All Species (default)

```sql
SELECT * FROM marine
```

### Performance Considerations

- **Indexed queries**: Uses database indexes on `collections.device_id` and `collections.marine_id`
- **Efficient joins**: Uses INNER JOIN for collected species
- **Subquery optimization**: Uses NOT IN subquery for non-collected species
- **Pagination support**: All queries support pagination for large datasets

### Error Handling

- **Missing deviceId**: Returns validation error if `collected` is provided without `deviceId`
- **Invalid deviceId**: Returns empty results for non-existent device IDs
- **Database errors**: Proper error handling for database connection issues

## Frontend Integration

### React Native Example

```javascript
// Get collected species
const getCollectedSpecies = async (deviceId) => {
  try {
    const response = await fetch(`/api/marine?collected=true&deviceId=${deviceId}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching collected species:', error);
    return [];
  }
};

// Get non-collected species
const getNonCollectedSpecies = async (deviceId) => {
  try {
    const response = await fetch(`/api/marine?collected=false&deviceId=${deviceId}`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching non-collected species:', error);
    return [];
  }
};

// Get all species with collection status
const getAllSpeciesWithStatus = async (deviceId) => {
  try {
    const response = await fetch(`/api/marine?deviceId=${deviceId}&sort=collected`);
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching species with status:', error);
    return [];
  }
};
```

### UI Components

#### Collection Status Tabs

```javascript
const CollectionTabs = ({ deviceId, onSpeciesLoad }) => {
  const [activeTab, setActiveTab] = useState('all');
  
  const loadSpecies = async (tab) => {
    let url = '/api/marine';
    
    if (tab === 'collected') {
      url += `?collected=true&deviceId=${deviceId}`;
    } else if (tab === 'non-collected') {
      url += `?collected=false&deviceId=${deviceId}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    onSpeciesLoad(data.data);
  };
  
  return (
    <View style={styles.tabs}>
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'all' && styles.activeTab]}
        onPress={() => {
          setActiveTab('all');
          loadSpecies('all');
        }}
      >
        <Text>All Species</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'collected' && styles.activeTab]}
        onPress={() => {
          setActiveTab('collected');
          loadSpecies('collected');
        }}
      >
        <Text>Collected</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.tab, activeTab === 'non-collected' && styles.activeTab]}
        onPress={() => {
          setActiveTab('non-collected');
          loadSpecies('non-collected');
        }}
      >
        <Text>Not Collected</Text>
      </TouchableOpacity>
    </View>
  );
};
```

## Benefits

### 1. Enhanced User Experience

- **Personalized view**: Users can focus on their collection progress
- **Goal setting**: Easy to see what species they still need to find
- **Achievement tracking**: Visual progress of collection completion

### 2. Improved Navigation

- **Quick filtering**: No need to scroll through all species
- **Efficient browsing**: Focus on relevant species only
- **Collection management**: Easy to manage and review collected species

### 3. Performance Benefits

- **Reduced data transfer**: Only load relevant species
- **Faster queries**: Optimized database queries
- **Better pagination**: More efficient pagination for filtered results

## Migration Notes

### Backward Compatibility

- **Existing behavior unchanged**: All existing API calls continue to work
- **Optional parameters**: New parameters are optional and don't affect existing functionality
- **Default behavior**: When no collected filter is applied, shows all species as before

### Database Requirements

- **Collections table**: Requires the existing collections table structure
- **Indexes**: Uses existing indexes on collections table
- **No schema changes**: No database schema modifications required

## Testing

### Manual Testing

1. **Test collected filter**:
   ```bash
   curl "http://localhost:3000/api/marine?collected=true&deviceId=test123"
   ```

2. **Test non-collected filter**:
   ```bash
   curl "http://localhost:3000/api/marine?collected=false&deviceId=test123"
   ```

3. **Test with other filters**:
   ```bash
   curl "http://localhost:3000/api/marine?collected=true&deviceId=test123&category=Fishes"
   ```

### Automated Testing

```javascript
describe('Marine API - Collected Filter', () => {
  test('should return all species when no collected filter applied', async () => {
    const response = await request(app).get('/api/marine');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('should return only collected species', async () => {
    const response = await request(app)
      .get('/api/marine')
      .query({ collected: true, deviceId: 'test123' });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('should return only non-collected species', async () => {
    const response = await request(app)
      .get('/api/marine')
      .query({ collected: false, deviceId: 'test123' });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
  
  test('should require deviceId when collected filter is used', async () => {
    const response = await request(app)
      .get('/api/marine')
      .query({ collected: true });
    expect(response.status).toBe(400);
  });
});
```

## Conclusion

The collected filter functionality enhances the marine species API by providing users with personalized views of their collection progress. The implementation is efficient, backward-compatible, and provides a better user experience for managing marine species collections.
