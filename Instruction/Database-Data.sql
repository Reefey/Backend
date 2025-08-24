-- =====================================================
-- REEFEY APP DATABASE DATA
-- =====================================================
-- Run this SQL script in Supabase SQL Editor to insert sample data
-- Make sure to run Database-Schema.sql first!
-- =====================================================

-- =====================================================
-- SAMPLE SPOTS DATA
-- =====================================================

-- Insert sample snorkeling spots
INSERT INTO spots (name, lat, lng, description, difficulty, best_time) VALUES
('Menjangan Island', -8.1526, 114.5139, 'Beautiful coral reef with diverse marine life', 'Easy', 'Morning'),
('Tulamben', -8.2756, 115.5879, 'Famous for the USAT Liberty wreck', 'Medium', 'Morning'),
('Nusa Penida', -8.7278, 115.5444, 'Manta ray cleaning stations', 'Hard', 'Morning'),
('Gili Islands', -8.3500, 116.0417, 'Turtle sanctuary and coral gardens', 'Easy', 'Morning'),
('Amed', -8.3667, 115.6333, 'Black sand beaches and macro life', 'Medium', 'Morning')
ON CONFLICT DO NOTHING;

-- =====================================================
-- SAMPLE MARINE SPECIES DATA
-- =====================================================

-- Insert basic marine species (generated data)
INSERT INTO marine (name, scientific_name, category, rarity, size_min_cm, size_max_cm, habitat_type, diet, behavior, danger, venomous, description, life_span, reproduction, migration, endangered, fun_fact) VALUES
('Clownfish', 'Amphiprion ocellaris', 'Fishes', 2, 6.0, 11.0, ARRAY['Coral Reefs', 'Anemones'], 'Omnivore', 'Social', 'Low', false, 'The iconic clownfish is famous for its symbiotic relationship with sea anemones. They are immune to the anemone''s stinging cells and provide protection in return.', '6-10 years', 'Eggs near anemone; male guards', 'Site-attached to host', 'Least Concern', 'Sequential hermaphrodites - all clownfish are born male and can change to female'),
('Blue Tang', 'Paracanthurus hepatus', 'Fishes', 2, 20.0, 30.0, ARRAY['Coral Reefs'], 'Herbivore', 'Social', 'Low', false, 'Bright blue surgeonfish with distinctive yellow tail and black markings. Popular in the aquarium trade.', '20-30 years', 'Egg laying in open water', 'Local', 'Least Concern', 'Featured in Finding Nemo as Dory'),
('Sea Turtle', 'Chelonia mydas', 'Creatures', 3, 80.0, 120.0, ARRAY['Coral Reefs', 'Seagrass Beds'], 'Herbivore', 'Solitary', 'Low', false, 'Green sea turtles are ancient reptiles that can live for decades. They are excellent swimmers and can hold their breath for hours.', '80+ years', 'Egg laying on beaches', 'Long-distance', 'Endangered', 'Can migrate thousands of kilometers'),
('Manta Ray', 'Mobula alfredi', 'Fishes', 4, 300.0, 500.0, ARRAY['Cleaning stations', 'Coastal', 'Oceanic'], 'Zooplankton (filter feeding)', 'Migratory', 'Low', false, 'One of the largest brains among fishes, found at cleaning stations. They are gentle giants that feed on plankton.', '40+ years', 'Live birth', 'Long-distance', 'Vulnerable', 'Have the largest brain-to-body ratio of any fish'),
('Reef Octopus', 'Octopus cyanea', 'Creatures', 2, 20.0, 40.0, ARRAY['Shallow reefs', 'Rubble flats'], 'Carnivore', 'Nocturnal', 'Medium', true, 'Masters of color and texture change, active at dusk and night. Highly intelligent and curious.', '1-2 years', 'Egg laying in den', 'Local', 'Least Concern', 'Can change color and texture in milliseconds')
ON CONFLICT (name) DO NOTHING;

-- Insert comprehensive marine species from Bali data
INSERT INTO marine (name, scientific_name, category, rarity, size_min_cm, size_max_cm, habitat_type, diet, behavior, danger, venomous, description, life_span, reproduction, migration, endangered, fun_fact) VALUES
('Reef manta ray', 'Mobula alfredi', 'Fishes', 3, 300.0, 500.0, ARRAY['Cleaning stations', 'Coastal', 'Oceanic'], 'Zooplankton (filter feeding)', 'Migratory', 'Low', false, 'One of the largest brains among fishes, found at cleaning stations. They are gentle giants that feed on plankton.', '40-50+ years', 'Aplacental live-bearer; ~1 pup/12-13 mo', 'Regional movements with site fidelity', 'Vulnerable', 'One of the largest brains among fishes'),
('Ocean sunfish (mola)', 'Mola alexandrini', 'Fishes', 4, 200.0, 300.0, ARRAY['Deep pelagic'], 'Jellies/gelatinous zooplankton', 'Solitary', 'Low', false, 'Large but gentle ocean sunfish that visits cleaning stations.', 'Long (uncertain)', 'Pelagic broadcast spawner; very fecund', 'Vertical migrations; cleaning stations', 'Not clearly assessed', 'Often miscalled M. mola; Bali is M. alexandrini'),
('Blacktip reef shark', 'Carcharhinus melanopterus', 'Fishes', 3, 100.0, 200.0, ARRAY['Shallow reefs', 'Lagoons'], 'Fish, cephalopods, crustaceans', 'Solitary', 'Medium', false, 'Shy shark with distinct black fin tips, commonly seen in shallow waters.', '10-15+ years', 'Viviparous (live-bearing)', 'Home ranges on reefs', 'Vulnerable', 'Distinct black fin tips'),
('Whitetip reef shark', 'Triaenodon obesus', 'Fishes', 2, 100.0, 170.0, ARRAY['Reefs', 'Caves'], 'Reef fishes, octopus', 'Nocturnal', 'Low', false, 'Generally docile shark that can rest on the bottom using buccal pumping.', '20+ years', 'Viviparous', 'Resident small ranges', 'Near Threatened', 'Can rest on bottom (buccal pumping)'),
('Grey reef shark', 'Carcharhinus amblyrhynchos', 'Fishes', 3, 150.0, 250.0, ARRAY['Outer reef slopes', 'Drop-offs'], 'Fish, cephalopods', 'Solitary', 'Medium', false, 'Territorial shark that shows threat posture when agitated.', '20-25 years', 'Viviparous', 'Local movements along reef edges', 'Vulnerable', 'Threat posture when agitated'),
('Blue-spotted ribbontail ray', 'Taeniura lymma', 'Fishes', 2, 30.0, 70.0, ARRAY['Shallow sandy lagoons', 'Reefs'], 'Crustaceans, worms, small fish', 'Solitary', 'Medium', true, 'Bright blue warning spots, often resting under ledges.', '10-15 years', 'Ovoviviparous', 'Small home ranges', 'Near Threatened', 'Bright blue warning spots'),
('Spotted eagle ray', 'Aetobatus ocellatus', 'Fishes', 3, 150.0, 300.0, ARRAY['Coastal reefs', 'Sandy flats'], 'Mollusks, crustaceans', 'Solitary', 'Medium', true, 'Graceful swimmers that dig with snout for prey.', '25 years', 'Ovoviviparous (live-bearing)', 'Local/regional movements', 'Vulnerable', 'Digs with snout for prey'),
('Reef stonefish', 'Synanceia verrucosa', 'Fishes', 4, 20.0, 40.0, ARRAY['Reef flats', 'Rubble'], 'Small fish & shrimp', 'Ambush', 'Extreme', true, 'Most venomous fish, strikes prey in ~0.015 seconds.', 'Poorly documented', 'External fertilization; eggs on substrate', 'Sedentary ambush', 'Least Concern', 'Strikes prey in ~0.015 s'),
('Common lionfish', 'Pterois volitans', 'Fishes', 2, 20.0, 38.0, ARRAY['Reefs', 'Ledges', 'Rubble'], 'Small fish & inverts', 'Solitary', 'High', true, 'Native to Indonesia; invasive in Atlantic. Venomous spines.', '10-15 years', 'Frequent spawner; buoyant eggs', 'Site-attached', 'Not threatened', 'Native to Indonesia; invasive in Atlantic'),
('Giant trevally (GT)', 'Caranx ignobilis', 'Fishes', 3, 50.0, 170.0, ARRAY['Lagoons', 'Seaward reefs', 'Estuaries'], 'Fish, cephalopods, crustaceans', 'Solitary', 'Medium', false, 'Apex reef predator; clever hunting fish.', 'Decades', 'Spawns on seaward reefs/banks', 'Local reef moves; spawning aggregations', 'Least Concern', 'Apex reef predator; clever hunting'),
('Giant moray', 'Gymnothorax javanicus', 'Fishes', 2, 100.0, 300.0, ARRAY['Reefs', 'Rubble', 'Caves'], 'Fish, crustaceans', 'Solitary', 'Medium', false, 'Cooperative hunts with groupers. Keep hands clear of holes.', 'Likely decades', 'Broadcast spawner; leptocephalus larva', 'Larval drift; site-attached adults', 'Least Concern', 'Cooperative hunts with groupers'),
('Titan triggerfish', 'Balistoides viridescens', 'Fishes', 2, 30.0, 75.0, ARRAY['Reefs', 'Sandy patches'], 'Urchins, mollusks, crustaceans', 'Territorial', 'Medium', false, 'Chases divers from nest cone. Approach from above, not downslope.', '10+ years', 'Guards eggs in sand cone', 'Site-attached territories', 'Least Concern', 'Chases divers from nest cone'),
('Banded sea krait (yellow-lipped)', 'Laticauda colubrina', 'Creatures', 3, 80.0, 140.0, ARRAY['Reefs'], 'Eels, small fish', 'Solitary', 'High', true, 'Highly venomous but docile. Amphibious lifestyle (land & sea).', 'Several years', 'Egg-laying on land', 'Local foraging circuits', 'Not globally endangered', 'Amphibious lifestyle (land & sea)'),
('Mimic octopus', 'Thaumoctopus mimicus', 'Creatures', 3, 20.0, 60.0, ARRAY['Muck', 'Sandy bottoms'], 'Crustaceans, small fish', 'Solitary', 'Medium', true, 'Imitates lionfish, flatfish, sea snake. Iconic macro subject.', '1-2 years', 'Semelparous; egg-brooding', 'Sedentary small ranges', 'Data Deficient', 'Imitates lionfish, flatfish, sea snake'),
('Coconut octopus', 'Amphioctopus marginatus', 'Creatures', 3, 8.0, 15.0, ARRAY['Muck', 'Sand'], 'Crabs, clams', 'Solitary', 'Medium', true, 'Carries shells as mobile armor. Exhibits tool-like object use.', '1-2 years', 'Egg-brooding; female guards', 'Local movements', 'Not widely assessed', 'Carries shells as mobile armor'),
('Broadclub cuttlefish', 'Sepia latimanus', 'Creatures', 2, 20.0, 50.0, ARRAY['Reefs', 'Seagrass edges'], 'Crustaceans, fish', 'Solitary', 'Low', false, 'Dynamic color waves for communication. Intelligent cephalopod.', '1-2 years', 'Grape-like egg clusters on corals/seagrass', 'Local seasonal moves', 'Not threatened', 'Dynamic color waves for communication'),
('Flamboyant cuttlefish', 'Metasepia pfefferi', 'Creatures', 4, 6.0, 8.0, ARRAY['Muck flats', 'Sandy bottoms'], 'Small crustaceans & fish', 'Solitary', 'Low', false, 'Walks on arms with vivid displays. Photographers'' favorite.', '1-2 years', 'Eggs under ledges/debris', 'Sedentary', 'Data Deficient', 'Walks on arms with vivid displays'),
('Bigfin reef squid', 'Sepioteuthis lessoniana', 'Creatures', 2, 20.0, 40.0, ARRAY['Seagrass', 'Nearshore waters'], 'Small fish, crustaceans', 'Social', 'Low', false, 'Rapid color changes in schools. Common in night dives.', '1 year', 'Egg capsules on seagrass/ropes', 'Short coastal moves', 'Not threatened', 'Rapid color changes in schools'),
('Peacock mantis shrimp', 'Odontodactylus scyllarus', 'Creatures', 3, 3.0, 18.0, ARRAY['Reef rubble', 'Burrows'], 'Crabs, snails', 'Solitary', 'High', false, 'Sees polarized light; devastating strike. Do not place fingers near holes.', 'Several years', 'Complex mating; egg brooding', 'Burrow-based territories', 'Not listed as threatened', 'Sees polarized light; devastating strike'),
('Crown-of-thorns starfish', 'Acanthaster planci', 'Creatures', 3, 20.0, 40.0, ARRAY['Coral reefs'], 'Live coral polyps', 'Solitary', 'High', true, 'Consumes coral tissue rapidly. Report outbreaks to park staff.', '3-4+ years', 'Broadcast spawner; high fecundity', 'Crawls; larvae drift', 'Not endangered', 'Consumes coral tissue rapidly'),
('Blue sea star', 'Linckia laevigata', 'Creatures', 2, 10.0, 30.0, ARRAY['Shallow reefs', 'Seagrass'], 'Biofilm, detritus', 'Solitary', 'Low', false, 'Regrows arms; vivid blue. Handle gently; keep underwater.', 'Several years', 'Spawning; can clone from fragments', 'Minimal; slow', 'Least Concern', 'Regrows arms; vivid blue'),
('Spinner dolphin', 'Stenella longirostris', 'Creatures', 3, 130.0, 240.0, ARRAY['Offshore', 'Coastal'], 'Small fish, squid', 'Social', 'Low', false, 'Acrobatic spinning leaps. Often seen at dawn.', '20-30+ years', 'Live-bearing; ~12-mo gestation', 'Local/regional following prey', 'Varies by stock', 'Acrobatic spinning leaps'),
('Staghorn coral (branching)', 'Acropora palifera', 'Corals', 2, 10.0, 100.0, ARRAY['Shallow flats', 'Slopes'], 'Symbionts + plankton capture', 'Sessile', 'Low', true, 'Fast-growing habitat former. Used in Bali reef restoration.', 'Decades', 'Broadcast spawner; fragments easily', 'Sessile; larvae drift', 'Varies by species', 'Fast-growing habitat former'),
('Bird''s nest coral', 'Seriatopora hystrix', 'Corals', 2, 5.0, 50.0, ARRAY['Current-swept slopes'], 'Symbionts + zooplankton', 'Sessile', 'Low', true, 'Delicate branches shelter small fish. Pink/brown morphs in Bali.', 'Years-decades', 'Brooding/spawning; fragments easily', 'Sessile; planula drift', 'Least Concern', 'Delicate branches shelter small fish'),
('Long-tentacle plate coral', 'Heliofungia actiniformis', 'Corals', 2, 10.0, 30.0, ARRAY['Sandy patches', 'Slopes'], 'Zooplankton + symbionts', 'Sessile', 'Low', true, 'Free-living single polyp resembling anemone. Iconic in aquarium trade.', 'Years', 'Sexual spawning; asexual budding', 'Sessile/free-living on sand', 'Near Threatened', 'Free-living single polyp resembling anemone'),
('Sun coral (azooxanthellate)', 'Tubastraea coccinea', 'Corals', 2, 5.0, 20.0, ARRAY['Wrecks', 'Overhangs'], 'Zooplankton', 'Sessile', 'Low', true, 'Lacks symbionts; must capture food. Bright orange/yellow on the Liberty.', 'Years', 'Brooding & budding; spreads on structures', 'Sessile; larvae drift', 'Not globally threatened', 'Lacks symbionts; must capture food'),
('Sea fan (gorgonian)', 'Annella / Melithaea spp.', 'Corals', 2, 20.0, 100.0, ARRAY['Walls', 'Drop-offs'], 'Plankton (azooxanthellate)', 'Sessile', 'Low', true, 'Home to pygmy seahorses in NW Bali. Large colorful fans on walls.', 'Years-decades', 'Broadcast spawner; branch growth', 'Sessile; larvae drift', 'Not broadly assessed', 'Home to pygmy seahorses in NW Bali')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- SAMPLE SPOT-MARINE RELATIONSHIPS
-- =====================================================

-- Insert relationships between spots and marine species
INSERT INTO spot_marine (spot_id, marine_id, frequency, seasonality, notes) VALUES
(1, 1, 'Common', 'Year-round', 'Found near anemones in shallow waters'),
(1, 3, 'Occasional', 'Year-round', 'Often seen feeding on seagrass'),
(1, 2, 'Rare', 'Summer months', 'Found in deeper reef areas'),
(2, 1, 'Occasional', 'Year-round', 'Occasionally seen in coral gardens'),
(2, 5, 'Common', 'Night', 'Active at night around the wreck'),
(3, 4, 'Common', 'Year-round', 'Famous manta ray cleaning stations'),
(4, 3, 'Common', 'Year-round', 'Turtle sanctuary area'),
(5, 5, 'Occasional', 'Night', 'Found in shallow waters at night')
ON CONFLICT (spot_id, marine_id) DO NOTHING;

-- =====================================================
-- DATA INSERTION COMPLETE
-- =====================================================
-- Sample data has been inserted:
-- ✅ 5 snorkeling spots
-- ✅ 30+ marine species (fishes, creatures, corals)
-- ✅ Spot-marine relationships
-- 
-- Your database is now ready for the Reefey app! 🐠
