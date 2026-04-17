insert into public.materials (title, file_url, grade, subject, category_tags, year, origin, downloads, metadata)
values
  (
    'SPM Trial Add Maths 2024 - Johor',
    '#',
    'f5',
    'Additional Mathematics',
    array['trial-paper'],
    2024,
    'Johor',
    184,
    jsonb_build_object('grade', 'f5', 'subject', 'Additional Mathematics', 'category_tags', jsonb_build_array('trial-paper'), 'year', 2024, 'origin', 'Johor')
  ),
  (
    'MRSM Physics Past Year 2023',
    '#',
    'f5',
    'Physics',
    array['past-year'],
    2023,
    'MRSM',
    143,
    jsonb_build_object('grade', 'f5', 'subject', 'Physics', 'category_tags', jsonb_build_array('past-year'), 'year', 2023, 'origin', 'MRSM')
  ),
  (
    'Form 4 Biology Exercise Set - Respiration',
    '#',
    'f4',
    'Biology',
    array['exercise'],
    2025,
    'SBP',
    97,
    jsonb_build_object('grade', 'f4', 'subject', 'Biology', 'category_tags', jsonb_build_array('exercise'), 'year', 2025, 'origin', 'SBP')
  ),
  (
    'SPM Sejarah Past Year 2022',
    '#',
    'f5',
    'Sejarah',
    array['past-year'],
    2022,
    'State',
    231,
    jsonb_build_object('grade', 'f5', 'subject', 'Sejarah', 'category_tags', jsonb_build_array('past-year'), 'year', 2022, 'origin', 'State')
  ),
  (
    'Form 5 English Trial Paper - Negeri Sembilan',
    '#',
    'f5',
    'English',
    array['trial-paper'],
    2024,
    'Negeri Sembilan',
    118,
    jsonb_build_object('grade', 'f5', 'subject', 'English', 'category_tags', jsonb_build_array('trial-paper'), 'year', 2024, 'origin', 'Negeri Sembilan')
  ),
  (
    'Form 3 Mathematics Notes - Algebra',
    '#',
    'f3',
    'Mathematics',
    array['notes'],
    2025,
    'teacher-share',
    74,
    jsonb_build_object('grade', 'f3', 'subject', 'Mathematics', 'category_tags', jsonb_build_array('notes'), 'year', 2025, 'origin', 'teacher-share')
  ),
  (
    'Form 4 Chemistry Trial + Exercise Pack',
    '#',
    'f4',
    'Chemistry',
    array['trial-paper', 'exercise'],
    2025,
    'SBP',
    88,
    jsonb_build_object('grade', 'f4', 'subject', 'Chemistry', 'category_tags', jsonb_build_array('trial-paper', 'exercise'), 'year', 2025, 'origin', 'SBP')
  ),
  (
    'SPM Bahasa Melayu Past Year 2021',
    '#',
    'f5',
    'Bahasa Melayu',
    array['past-year'],
    2021,
    'State',
    165,
    jsonb_build_object('grade', 'f5', 'subject', 'Bahasa Melayu', 'category_tags', jsonb_build_array('past-year'), 'year', 2021, 'origin', 'State')
  );
