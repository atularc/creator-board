// The EMPTY starting data for a fresh install (used when seed.js is not present, or HQ_EDITION=fresh).
module.exports = function seedFresh() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0'), today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  return {
    meta: { app: 'Creator Board', version: 1, created: today },
    settings: {
      channelName: 'My channel', handle: '', style: '',
      schedule: { long: [2, 5], short: [0, 1, 2, 3, 4, 5, 6] },     // 0 = Sunday ... 6 = Saturday: long videos Tue + Fri, one short a day
      defaults: {}, seriesNames: {}, numberedSeries: [],
      rules: [
        'Every fact is looked up in a reliable source before the script is written. Put the links in the Sources box.',
        'The hook: the key word is spoken in the first second and is on screen in the first frame.',
        'Keep one look and one topic area, so viewers recognise the channel.',
        'Watch every video in full before uploading.',
      ],
    },
    snapshots: [],
    targets: [
      { id: 't1', name: 'Long video click rate (CTR)', target: '4% or more', current: '' },
      { id: 't2', name: 'Long video average watched', target: '35% or more', current: '' },
      { id: 't3', name: 'Shorts / Reels "stayed to watch"', target: '70% or more', current: '' },
      { id: 't4', name: 'Followers going up every week', target: 'up every week', current: '' },
    ],
    items: [], trash: [],
  };
};
