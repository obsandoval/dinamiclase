/* =====================================================================
   Story Icons · lista de íconos compartida
   Nombres de glifos de Material Symbols (https://fonts.google.com/icons).
   La usan storycube-normal.js y storycube-por-lotes.js.
   ===================================================================== */
(() => {
  'use strict';

  const ICONS = [
    'home', 'star', 'favorite', 'face', 'alarm', 'pets', 'flight', 'bedtime',
    'restaurant', 'delete', 'shopping_cart', 'school', 'sports_soccer', 'music_note', 'movie', 'local_cafe',
    'landscape', 'camera_alt', 'directions_car', 'beach_access', 'work', 'computer', 'phone_iphone', 'lightbulb',
    'cake', 'key', 'heart_plus', 'rocket_launch', 'workspace_premium', 'eco', 'announcement', 'gavel',
    'article', 'diversity_1', 'psychology', 'bluetooth', 'sunny', 'diamond', 'calendar_today', 'vaccines',
    'cruelty_free', 'forest', 'potted_plant', 'directions_bike', 'emoji_nature', 'elderly', 'skull', 'electric_car',
    'oil_barrel', 'dentistry', 'flag', 'lab_research', 'crown', 'headset', 'local_hospital', 'nature',
    'opacity', 'print', 'save', 'anchor', 'settings', 'shopping_bag', 'support_agent', 'thumb_up',
    'thumb_down', 'timer', 'visibility', 'comedy_mask', 'warning', 'wifi', 'mic_external_on', 'savings',
    'local_fire_department', 'account_circle', 'electrical_services', 'signpost', 'dry_cleaning', 'self_improvement', 'personal_injury', 'battery_full',
    'book', 'brush', 'bug_report', 'build_circle', 'climate_mini_split', 'camera', 'cancel', 'chat_bubble',
    'sports_bar', 'camping', 'smart_toy', 'fitness_center', 'ramen_dining', 'directions', 'golf_course', 'carpenter',
    'checkroom', 'tools_power_drill', 'tools_ladder', 'washoku', 'concierge', 'bath_bedrock', 'gite', 'attractions',
    'festival', 'nightlife', 'bakery_dining', 'chair_umbrella', 'fragrance', 'tools_pliers_wire_stripper', 'light_group', 'door_open',
    'blanket', 'health_and_beauty', 'grocery', 'microwave_gen', 'mode_cool', 'scene', 'bedroom_baby', 'blender',
    'grass', 'outdoor_grill', 'icecream', 'power', 'balance', 'device_thermostat', 'watch', 'stylus',
    'flashlight_on', 'person_play', 'sports_and_outdoors', 'cake_add', 'toys_and_games', 'steps', 'sprint', 'featured_seasonal_and_gifts',
    'swords', 'phishing', 'piano', 'toys', 'surfing', 'experiment', 'architecture', 'engineering',
    'construction', 'biotech', 'sports_motorsports', 'sports_esports', 'moped_package', 'speed_camera', 'auto_towing', 'swap_driving_apps_wheel',
    'pedal_bike', 'sailing', 'adaptive_audio_mic', 'hearing', 'book_5', 'ink_highlighter', 'imagesearch_roller', 'format_paint',
    'content_cut', 'design_services', 'history_edu', 'synagogue', 'local_gas_station', 'money_bag', 'nature_people', 'palette',
    'thread_unread', 'account_child_invert', 'chess_queen', 'planet', 'sentiment_worried', 'candle', 'siren', 'owl',
    'sentiment_sad', 'skeleton', 'neurology', 'volcano', 'flood', 'recycling', 'sick',
  ];

  // Íconos ya usados en esta sesión: no se repiten hasta agotar la lista
  let used = new Set();

  function shuffle(list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Devuelve `count` íconos distintos que no hayan salido todavía. */
  function pick(count, exclude = []) {
    const skip = new Set(exclude);
    let available = ICONS.filter((i) => !used.has(i) && !skip.has(i));
    if (available.length < count) {
      used = new Set(exclude);
      available = ICONS.filter((i) => !skip.has(i));
    }
    const chosen = shuffle(available).slice(0, count);
    chosen.forEach((i) => used.add(i));
    return chosen;
  }

  const random = () => ICONS[Math.floor(Math.random() * ICONS.length)];

  window.StoryIcons = { ICONS, pick, random, reset: () => { used = new Set(); } };
})();
