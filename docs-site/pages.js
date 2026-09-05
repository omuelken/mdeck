export const pages = [
  { slug: 'index', title: 'Welcome to mdeck', group: 'Start here', file: 'welcome.md', description: 'A friendly guide to making, presenting, and sharing your first slides.', preview: 'first-talk' },
  { slug: 'getting-started', title: 'Make your first presentation', group: 'Start here', file: 'getting-started.md', description: 'Set up mdeck, make a slide file, and see your words become a presentation.' },
  { slug: 'writing', title: 'Write your slides', group: 'Make your presentation', file: 'writing.md', description: 'Headings, paragraphs, lists, and the simple marks that turn text into slides.' },
  { slug: 'layouts', title: 'Choose a slide layout', group: 'Make your presentation', file: 'layouts.md', description: 'Choose a title slide, a big statement, a picture, or two columns.', preview: 'first-talk' },
  { slug: 'pictures-and-video', title: 'Add pictures and video', group: 'Make your presentation', file: 'media.md', description: 'Put an image or a video into your talk and keep its files together.' },
  { slug: 'appearance', title: 'Change the look', group: 'Make your presentation', file: 'appearance.md', description: 'Choose fonts and colors with themes and palettes.' },
  { slug: 'notes-and-presenting', title: 'Add notes and present', group: 'Present and share', file: 'presenting.md', description: 'See your notes, reveal points one at a time, and open the audience screen.' },
  { slug: 'sharing', title: 'Share or print your slides', group: 'Present and share', file: 'sharing.md', description: 'Make a shareable folder, a single file, or a PDF.' },
  { slug: 'more-content', title: 'Tables, tips, and more', group: 'Keep learning', file: 'more-content.md', description: 'Add tables, helpful callouts, QR codes, formulas, and code examples.' },
  { slug: 'reusable-designs', title: 'Use a reusable slide design', group: 'Keep learning', file: 'reusable-designs.md', description: 'Use a slide design someone has made for you, including the comparison example.', preview: 'custom-templates' },
  { slug: 'commands', title: 'Command guide', group: 'Help and reference', file: 'commands.md', description: 'What each mdeck command does and when to use it.' },
  { slug: 'troubleshooting', title: 'When something goes wrong', group: 'Help and reference', file: 'troubleshooting.md', description: 'Find a missing picture, fix a typing mistake, or recover a command that will not run.' },
  { slug: 'custom-templates', title: 'Create a custom slide design', group: 'Advanced customization', source: '../docs/templates.md', description: 'For people comfortable with JavaScript: define a layout, its content areas, and its settings.' },
  { slug: 'components', title: 'Create interactive content', group: 'Advanced customization', file: 'components.md', description: 'Extend slides with your own Preact components.' },
  { slug: 'theme-authoring', title: 'Create a theme or palette', group: 'Advanced customization', file: 'theme-authoring.md', description: 'For people comfortable with CSS: create a visual identity for a whole deck.' },
  { slug: 'source-model', title: 'Build tools around mdeck', group: 'Advanced customization', source: '../docs/structured-slides.md', description: 'The source-preserving document model and editing helpers for tool authors.' },
]

export const pageFor = slug => pages.find(page => page.slug === slug)
