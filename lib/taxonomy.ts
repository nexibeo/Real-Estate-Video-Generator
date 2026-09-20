/**
 * Room taxonomy — PROJECT.md §4 Stage 3.
 *
 * `description` text is sent to Jev verbatim as Choice criteria, so it has to
 * describe a *situation* a judge could recognise, not a label. The Jev guide is
 * explicit about this: described options beat bare names by a wide margin.
 */

export const ROOM_TYPES = {
  exterior_front: 'The front or street-facing outside of the building, including the facade, front door or driveway',
  exterior_rear: 'The back or side outside of the building, seen from the garden or yard',
  entry: 'An entrance hall, foyer or mudroom just inside the front door',
  hallway: 'A corridor or landing connecting other rooms',
  living_room: 'A room for sitting and relaxing, with sofas or armchairs facing each other or a television',
  open_plan: 'One continuous space combining two or more of living, dining and kitchen with no dividing wall',
  dining_room: 'A room whose main furniture is a dining table with chairs around it',
  kitchen: 'A room for cooking, with counters, cabinets, a sink and appliances',
  bedroom: 'A room for sleeping whose main furniture is a bed for adults',
  kids_room: "A bedroom or playroom furnished for a child: bunk beds, a cot, toys or children's decor",
  bathroom: 'A room with a bath or shower and a sink, used by anyone in the home',
  ensuite: 'A bathroom opening directly off a bedroom',
  home_office: 'A room set up for work or study, with a desk and a chair',
  laundry: 'A utility room with a washing machine, dryer or laundry sink',
  garage: 'An enclosed space for parking a car, or a carport',
  balcony: 'A small raised outdoor platform attached to the building with a railing',
  terrace: 'A paved outdoor sitting area at ground or roof level, larger than a balcony',
  garden: 'An outdoor area of lawn, planting or trees belonging to the property',
  pool: 'An outdoor or indoor swimming pool and the deck around it',
  gym: 'A room containing exercise equipment',
  view: 'A photo whose subject is the scenery visible from the property rather than the property itself',
  detail: 'A close-up of one feature such as a tap, a handle, a fireplace or a tiled surface',
  floorplan: 'A drawn architectural plan, diagram or measured layout of the property, not a photograph',
  map: 'A map, an aerial or satellite image, or a picture of the surrounding area or neighbourhood',
  other: 'A photograph that fits none of the above, such as a logo, a text card or an unrelated image',
} as const;

export type RoomType = keyof typeof ROOM_TYPES;
export const ROOM_KEYS = Object.keys(ROOM_TYPES) as RoomType[];

/** Types that never become a shot. */
export const EXCLUDED_TYPES: RoomType[] = ['floorplan', 'map', 'other'];

/** Narrative order for the final edit — PROJECT.md §4 Stage 4. */
export const NARRATIVE_ORDER: RoomType[] = [
  'exterior_front', 'entry', 'hallway', 'living_room', 'open_plan', 'dining_room',
  'kitchen', 'bedroom', 'kids_room', 'ensuite', 'bathroom', 'home_office',
  'laundry', 'gym', 'garage', 'balcony', 'terrace', 'garden', 'pool', 'view',
  'exterior_rear', 'detail',
];

/** Tie-breaker when there are more rooms than `maxClips`. Higher wins. */
export const ROOM_PRIORITY: Record<RoomType, number> = {
  exterior_front: 1.0, living_room: 0.98, kitchen: 0.97, open_plan: 0.95,
  bedroom: 0.9, pool: 0.88, view: 0.85, garden: 0.82, bathroom: 0.8,
  dining_room: 0.78, terrace: 0.75, exterior_rear: 0.72, entry: 0.7,
  balcony: 0.68, ensuite: 0.6, home_office: 0.55, kids_room: 0.5,
  gym: 0.45, hallway: 0.35, laundry: 0.3, garage: 0.28, detail: 0.2,
  floorplan: 0, map: 0, other: 0,
};

/** Human labels for the UI and for the on-screen room caption. */
export const ROOM_LABELS: Record<RoomType, string> = {
  exterior_front: 'Exterior', exterior_rear: 'Rear Exterior', entry: 'Entrance',
  hallway: 'Hallway', living_room: 'Living Room', open_plan: 'Open Plan Living',
  dining_room: 'Dining Room', kitchen: 'Kitchen', bedroom: 'Bedroom',
  kids_room: "Children's Room", bathroom: 'Bathroom', ensuite: 'Ensuite',
  home_office: 'Home Office', laundry: 'Laundry', garage: 'Garage',
  balcony: 'Balcony', terrace: 'Terrace', garden: 'Garden', pool: 'Pool',
  gym: 'Gym', view: 'The View', detail: 'Detail', floorplan: 'Floor Plan',
  map: 'Location', other: 'Other',
};

export const CAMERA_DEPTHS = {
  wide: 'The photo shows most of a room or the whole outside of the building, with floor and several walls visible',
  medium: 'The photo shows a part of a room, a corner or one wall, with furniture at normal distance',
  closeup: 'The photo is filled by one object or surface seen from close range',
} as const;
export type CameraDepth = keyof typeof CAMERA_DEPTHS;

export const PRIMARY_AXES = {
  into_frame: 'The space runs away from the camera into the distance, down a corridor, a sight line or a long room',
  left_to_right: 'The space runs sideways across the photo, such as a counter, a row of cabinets or a wall of windows',
  centred: 'One subject sits in the middle of the photo with the space arranged around it',
} as const;
export type PrimaryAxis = keyof typeof PRIMARY_AXES;
