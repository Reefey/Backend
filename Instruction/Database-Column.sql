-- Step 1: Add new boolean columns
ALTER TABLE public.marine
ADD COLUMN edibility boolean,
ADD COLUMN poisonous boolean,
ADD COLUMN endangeredd boolean;

-- Step 2: Insert or update rows with boolean values
INSERT INTO public.marine (id, name, scientific_name, image_url, category, edibility, poisonous, endangeredd)
VALUES
(1, 'Clownfish', 'Amphiprion ocellaris', 'https://upload.wikimedia.org/wikipedia/commons/0/0a/Clownfish.jpg', 'Fishes', true, false, false),
(2, 'Blue Tang', 'Paracanthurus hepatus', 'https://upload.wikimedia.org/wikipedia/commons/3/3a/Blue_Tang.jpg', 'Fishes', false, false, false),
(3, 'Sea Turtle', 'Chelonia mydas', 'https://upload.wikimedia.org/wikipedia/commons/2/20/Sea_turtle.jpg', 'Creatures', false, false, true),
(4, 'Manta Ray', 'Mobula alfredi', 'https://upload.wikimedia.org/wikipedia/commons/8/89/Manta_ray.jpg', 'Fishes', false, false, true),
(5, 'Reef Octopus', 'Octopus cyanea', 'https://upload.wikimedia.org/wikipedia/commons/9/9c/Reef_octopus.jpg', 'Creatures', true, false, false),
(6, 'Reef manta ray', 'Mobula alfredi', 'https://nuspedia.org/wp-content/uploads/reef_manta.jpg', 'Fishes', false, false, true),
(7, 'Ocean sunfish (mola)', 'Mola alexandrini', 'https://lh5.googleusercontent.com/VzJ_iSunfish.jpg', 'Fishes', true, false, true),
(8, 'Blacktip reef shark', 'Carcharhinus melanopterus', 'https://upload.wikimedia.org/wikipedia/commons/4/4d/Blacktip_reef_shark.jpg', 'Fishes', true, false, true)
ON CONFLICT (id) DO UPDATE 
SET edibility = EXCLUDED.edibility,
    poisonous = EXCLUDED.poisonous,
    endangeredd = EXCLUDED.endangeredd;
