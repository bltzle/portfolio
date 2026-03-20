import { useState, useEffect, useRef } from 'react'
import { CornerDownLeftIcon } from './CornerDownLeftIcon'
import { ShaderGradient, ShaderGradientCanvas } from 'shadergradient'
import { Agentation } from 'agentation'
import './style.css'

const projects = [
  {
    name: 'Ritual Dental',
    desc: 'Using AI to better inform patient oral health',
    year: '2024',
    tagline: 'Personalized preventative oral care that sticks',
    role: 'Product Designer',
    tools: 'Figma',
    team: ['Gabriel Valdivia', 'Alex Valdivia', 'Arman Ozgun', 'Daniel Chung'],
    overview: 'Ritual Dental is a next-generation dental practice using AI to form a comprehensive health perspective for prevention and early detection to boost patients quality of life.',
    timeline: 'May – June (2 months)',
    sections: [
      { id: 'problem',    heading: 'Ritual Dental' },
      { id: 'gum',        heading: 'Gum Health' },
      { id: 'bacteria',   heading: 'Bacteria Table' },
      { id: 'abundance',  heading: 'Abundance levels' },
      { id: 'impact',     heading: 'Impact' },
      { id: 'outcome',       heading: 'Outcome' },
    ],
    content: [
      {
        id: 'problem',
        body: `Patients walk out of dental appointments with a treatment plan they didn't fully understand, from a conversation that felt one-sided. The clinical language, the time pressure, the authority dynamic — all of it conspires to leave people making decisions without adequate information.\n\nThe result is avoidance. People delay care, distrust recommendations, or simply disengage. The problem isn't that patients don't care about their health — it's that the system doesn't communicate with them on their terms.`,
      },
      {
        id: 'gum',
        heading: 'Gum Health',
        body: `Placeholder content for Gum Health.`,
      },
      {
        id: 'bacteria',
        heading: 'Bacteria Table',
        body: `Placeholder content for Bacteria Table.`,
      },
      {
        id: 'abundance',
        heading: 'Abundance levels',
        body: `Placeholder content for Abundance levels.`,
      },
      {
        id: 'impact',
        heading: 'Impact',
        body: `We designed around the moment after the appointment — when patients are processing what they were told and trying to decide what to do. The AI reads the treatment notes and translates them into plain language, surfaces relevant context, and answers follow-up questions.\n\nThe interface was kept deliberately calm. No dashboards, no overwhelming data. Just a conversation that respects the user's intelligence and doesn't try to alarm them into action.`,
      },
      {
        id: 'outcome',
        heading: 'Outcome',
        body: `Patients reported feeling more confident in their treatment decisions and more likely to follow through with recommended care. The design reduced the perceived distance between the patient and their own health information — which turns out to be most of the problem.`,
        noImageAfter: true,
      },
      {
        id: 'acknowledgements',
        heading: 'Acknowledgements',
        headingClass: 'note-image-caption note-image-caption--left',
        body: `This project was done with the help of my incredible teammates and in collaboration with Gabriel Valdivia, Alex Valdivia, Arman Ozgun, and Daniel Chung. We worked on this together over the course of summer 2024.`,
        bodyClass: 'note-image-caption note-image-caption--left',
        sectionClass: 'note-section--tight',
      },
    ],
  },
  { name: 'Goodword',              desc: 'Maintain relationships in your professional network',         year: '2024' },
  { name: 'Workmate',              desc: 'Turning your inbox into an auto-updating task list',         year: '2024' },
  { name: 'Sensible',              desc: 'A high yield account for your crypto',                       year: '2024' },
  { name: 'Dex',                   desc: 'Learning camera for children',                               year: '2025' },
  { name: 'Underline',             desc: 'An investment platform for alternative assets',              year: '2023' },
]

function useVisitorLocation() {
  const [location, setLocation] = useState(null)
  useEffect(() => {
    fetch('https://ipinfo.io/json')
      .then(r => r.json())
      .then(d => { if (d.city && d.region) setLocation(`${d.city}, ${d.region}`) })
      .catch(() => {})
  }, [])
  return location
}

function WorkFooter() {
  const location = useVisitorLocation()
  return (
    <div className="work-links">
      <a href="mailto:mabaltzelle@gmail.com">Email</a>
      <a href="http://www.linkedin.com/in/matthew-baltzelle" target="_blank" rel="noreferrer">LinkedIn</a>
      <a href="https://twitter.com/bltzle" target="_blank" rel="noreferrer">Twitter</a>
      <span className="visitor-location">Last visitor from <span className="visitor-location-value">{location ?? '—'}</span></span>
    </div>
  )
}

function GrainOverlay() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let raf
    let last = 0
    const fps = 12
    const interval = 1000 / fps
    const draw = (now) => {
      raf = requestAnimationFrame(draw)
      if (now - last < interval) return
      last = now
      const w = canvas.width  = canvas.offsetWidth
      const h = canvas.height = canvas.offsetHeight
      const img = ctx.createImageData(w, h)
      const data = img.data
      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255 | 0
        data[i] = data[i+1] = data[i+2] = v
        data[i+3] = 255
      }
      ctx.putImageData(img, 0, 0)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none', zIndex: 2, mixBlendMode: 'overlay' }} />
}

function BackNav({ setPage }) {
  return (
    <button className="back-nav" onClick={() => setPage('work')}>
      <CornerDownLeftIcon size={12} />
      Back
    </button>
  )
}

function Nav({ page, setPage }) {
  return (
    <nav className="nav">
      <a href="#" className={page === 'work'  ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('work')  }}>Home</a>
      <a href="#" className={page === 'about' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('about') }}>About</a>
      <a href="#" className={page === 'writing' ? 'active' : ''} onClick={e => { e.preventDefault(); setPage('writing') }}>Notes</a>
    </nav>
  )
}

function ProjectDetailPage({ project, onBack }) {
  const [activeId, setActiveId] = useState(project.sections[0]?.id)
  const containerRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observers = project.sections.map(({ id }) => {
      const el = container.querySelector(`#${id}`)
      if (!el) return null
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && !scrollingRef.current) setActiveId(id) },
        { root: null, rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      )
      observer.observe(el)
      return observer
    }).filter(Boolean)
    return () => observers.forEach(o => o.disconnect())
  }, [project])

  return (
    <div className="note-layout" ref={containerRef}>
      <TopFade />
      <aside className="note-sidebar">
        <button className="note-back" onClick={onBack}>← Back</button>
        <nav className="note-toc">
          {project.sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`note-toc-item${activeId === s.id ? ' active' : ''}`}
              onClick={e => {
                e.preventDefault()
                setActiveId(s.id)
                scrollingRef.current = true
                containerRef.current?.querySelector(`#${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => { scrollingRef.current = false }, 1000)
              }}
            >{s.heading}</a>
          ))}
        </nav>
      </aside>
      <article className="note-article">
        <header className="note-header">
          <h1 className="note-title">{project.name}</h1>
          <span className="note-date">{project.desc}</span>
        </header>
        {project.content.map((section, si) => (
          <>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {section.heading && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < project.content.length - 1 && !section.noImageAfter && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner">
                  <div className="note-image-placeholder" />
                  <div className="grain-overlay" />
                </div>
              </div>
            )}
          </>
        ))}
      </article>
    </div>
  )
}

function WorkPage({ setPage }) {
  const [activeProject, setActiveProject] = useState(null)

  if (activeProject) {
    return (
      <div key={activeProject.name} className="page-transition">
        <ProjectDetailPage project={activeProject} onBack={() => setActiveProject(null)} />
      </div>
    )
  }

  return (
    <div className="split">
      <div className="left">
        <GrainOverlay />
        <span className="left-label animate" style={{ animationDelay: '0.1s' }}>Hover a project</span>
        <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <ShaderGradient
            animate="on"
            axesHelper="off"
            brightness={1.2}
            cAzimuthAngle={0}
            cDistance={5.5}
            cPolarAngle={90}
            cameraZoom={1}
            color1="#708238"
            color2="#8A9A5B"
            color3="#556B2F"
            destination="onCanvas"
            embedMode="off"
            envPreset="city"
            format="gif"
            fov={40}
            frameRate={10}
            gizmoHelper="hide"
            grain="off"
            lightType="3d"
            pixelDensity={1.2}
            positionX={0}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={0}
            rotationZ={0}
            shader="defaults"
            type="waterPlane"
            uAmplitude={1}
            uDensity={0.6}
            uFrequency={5.5}
            uSpeed={0.1}
            uStrength={3.4}
            uTime={0}
            wireframe={false}
            zoomOut={false}
          />
        </ShaderGradientCanvas>
      </div>
      <div className="right">
        <Nav page="work" setPage={setPage} />
        <div className="content">
          <header className="header">
            <h1 className="animate" style={{ animationDelay: '0.1s' }}>Matthew Baltzelle</h1>
            <p className="animate" style={{ animationDelay: '0.15s' }}>Designer crafting stories for early stage companies</p>
          </header>
          <ul className="projects">
            {projects.map((p, i) => (
              <li
                key={p.name}
                className={`project animate${p.dim ? ' dim' : ''}`}
                style={{ animationDelay: `${0.3 + i * 0.05}s`, '--end-opacity': p.dim ? 0.4 : 1, cursor: p.sections ? 'pointer' : 'not-allowed' }}
                onClick={() => p.sections && setActiveProject(p)}
              >
                <span className="project-name">{p.name}</span>
                <span className="project-desc">{p.desc}</span>
                <span className="project-year">{p.year}</span>
              </li>
            ))}
          </ul>
        </div>
        <WorkFooter />
      </div>
    </div>
  )
}



const albums = [
  { title: 'Album 1', img: '/images/music/album1.jpg', fallback: 'https://picsum.photos/seed/a1/120/120', href: 'https://tidal.com/track/396213085/u' },
  { title: 'Album 2', img: '/images/music/album2.jpg', fallback: 'https://picsum.photos/seed/a2/120/120', href: 'https://tidal.com/track/452623922/u' },
  { title: 'Album 3', img: '/images/music/album3.jpg', fallback: 'https://picsum.photos/seed/a3/120/120', href: 'https://tidal.com/track/97458481/u'  },
  { title: 'Album 4', img: '/images/music/album4.jpg', fallback: 'https://picsum.photos/seed/a4/120/120', href: 'https://tidal.com/track/474707709/u' },
  { title: 'Album 5', img: '/images/music/album5.jpg', fallback: 'https://picsum.photos/seed/a5/120/120', href: 'https://tidal.com/track/314943653/u' },
  { title: 'Album 6', img: '/images/music/album6.jpg', fallback: 'https://picsum.photos/seed/a6/120/120', href: 'https://tidal.com/track/304142580/u' },
]


function AboutPage({ setPage }) {
  return (
    <div className="page">
      <Nav page="about" setPage={setPage} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>Baltzelle</h1>
        <div className="about-text">
          <p className="animate" style={{ animationDelay: '0.15s' }}>I am a designer currently helping craft software experiences for pre-seed and seed companies.</p>
          <p className="animate" style={{ animationDelay: '0.2s' }}>In middle school I began making designs for my online gaming profile. Eventually, this would lead me to design school, but I've really grown by building things and being exposed to others who are exceptional at their craft.</p>
          <p className="animate" style={{ animationDelay: '0.25s' }}>Currently I'm interested in code and glyph dithers. Outside of work I'm interested in baroque art, competitive CoD, and collecting niche fragrances.</p>
        </div>
      </div>
    </div>
  )
}

const writings = [
  {
    title: 'The Animation Bar',
    desc: 'On craft, borrowed from anime',
    year: '2026',
    date: 'March 2026',
    sections: [
      { id: 'motion',    heading: 'Motion as language' },
      { id: 'camera',    heading: 'Camera and composition' },
      { id: 'sound',     heading: 'Sound and timing' },
      { id: 'weight',    heading: 'Weight' },
      { id: 'bar',       heading: 'The bar' },
    ],
    content: [
      {
        id: 'motion',
        heading: 'Motion as language',
        body: `In Jujutsu Kaisen, characters don't just move — they communicate through motion. A sword swing carries weight. A step backward says something about fear. The animation studio isn't filling time between story beats; the movement is the story beat. Every frame is a decision.\n\nMost software animation doesn't work this way. Transitions happen because they were added, not because they mean something. An element fades in because fade is the default, not because fading in is the right way for that element to arrive.\n\nThe question worth asking isn't "should this animate?" but "what should this motion say?" That reframe alone would eliminate most of what currently gets shipped.`,
        captionPrefix: 'Maki and Mai Zenin, from ',
        caption: 'Jujutsu Kaisen',
        captionHref: 'https://en.wikipedia.org/wiki/Jujutsu_Kaisen',
      },
      {
        id: 'camera',
        heading: 'Camera and composition',
        body: `Demon Slayer uses camera angles the way a cinematographer would — low angles to establish scale, close-ups held just long enough to feel uncomfortable, wide shots that let silence do the work. The framing is doing half the emotional labor.\n\nIn product design, the equivalent is hierarchy. Where does the eye go first? What gets space and what gets compressed? These aren't aesthetic choices — they're compositional ones, and they shape how people feel before they've read a word.\n\nA screen has edges the same way a frame does. Most interfaces forget this. Content gets centered and padded uniformly, which is another way of saying the composition wasn't considered at all.`,
        captionPrefix: 'Frieren, from ',
        caption: 'Frieren: Beyond Journey\'s End',
        captionHref: 'https://en.wikipedia.org/wiki/Frieren',
      },
      {
        id: 'sound',
        heading: 'Sound and timing',
        body: `Frieren's score doesn't underscore — it breathes alongside the scene. The timing between a piece of music starting and a character speaking is deliberate to the frame. That precision is what separates animation that feels crafted from animation that feels produced.\n\nSoftware has an equivalent: the relationship between an interaction and its feedback. A button press, a confirmation, a transition. When the timing is off by 40ms it registers as cheap. Most people can't say why, but everyone feels it.\n\nTiming is the hardest craft to teach because it mostly lives in feel. But feel is learnable. You develop it by noticing when something lands wrong and being specific about why.`,
        captionPrefix: 'Thorfinn, from ',
        caption: 'Vinland Saga',
        captionHref: 'https://en.wikipedia.org/wiki/Vinland_Saga_(manga)',
      },
      {
        id: 'weight',
        heading: 'Weight',
        body: `Well-animated characters feel like they have mass. A landing carries impact. A turn has inertia. The physics aren't realistic — they're expressive. The animators are using the illusion of weight to make you feel something, not to simulate reality.\n\nSoftware interactions almost never have weight. Buttons spring back instantly. Panels appear from nowhere. Everything is weightless by default, which means everything feels equally insignificant.\n\nThe moments in software that feel considered are usually the ones where something resists slightly, or settles, or takes a beat longer than expected. Weight is how you tell the user that what just happened mattered.`,
        captionPrefix: 'Bojji, from ',
        caption: 'Ranking of Kings',
        captionHref: 'https://en.wikipedia.org/wiki/Ranking_of_Kings',
      },
      {
        id: 'bar',
        heading: 'The bar',
        body: `High-craft anime sets a standard that's useful to borrow — not aesthetically, but as a way of thinking. Every element is load-bearing. Nothing is there without a reason. The question isn't "does this look good?" but "what does this communicate, and is it communicating the right thing?"\n\nThat's the bar. Most software doesn't clear it. Not because the people making it don't care, but because the habit of asking the question isn't there yet.\n\nBuilding that habit is the actual work. The anime is just a useful place to see what it looks like when someone has already done it.`,
      },
    ],
  },
  {
    title: 'The Weight of Type',
    desc: 'How font choices carry more than words',
    year: '2025',
  },
]

function TopFade() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '120px',
      pointerEvents: 'none',
      zIndex: 10,
      background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 40%, rgba(255,255,255,0) 100%)',
    }} />
  )
}

function NoteDetailPage({ note, onBack }) {
  const [activeId, setActiveId] = useState(note.sections[0]?.id)
  const containerRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observers = note.sections.map(({ id }) => {
      const el = container.querySelector(`#${id}`)
      if (!el) return null
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting && !scrollingRef.current) setActiveId(id) },
        { root: null, rootMargin: '-30% 0px -60% 0px', threshold: 0 }
      )
      observer.observe(el)
      return observer
    }).filter(Boolean)
    return () => observers.forEach(o => o.disconnect())
  }, [note])

  return (
    <div className="note-layout" ref={containerRef}>
      <TopFade />
      <aside className="note-sidebar">
        <button className="note-back" onClick={onBack}>← Back</button>
        <nav className="note-toc">
          {note.sections.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`note-toc-item${activeId === s.id ? ' active' : ''}`}
              onClick={e => {
                e.preventDefault()
                setActiveId(s.id)
                scrollingRef.current = true
                containerRef.current?.querySelector(`#${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => { scrollingRef.current = false }, 1000)
              }}
            >{s.heading}</a>
          ))}
        </nav>
      </aside>
      <article className="note-article">
        <header className="note-header">
          <h1 className="note-title">{note.title}</h1>
          <span className="note-date">{note.date}</span>
        </header>
        {note.content.map((section, si) => (
          <>
            {(section.heading || section.body) && (
              <section key={section.id} id={section.id} className={`note-section${section.sectionClass ? ` ${section.sectionClass}` : ''}`}>
                {section.heading && <h2 className={section.headingClass ?? 'note-section-heading'}>{section.heading}</h2>}
                {section.body && section.body.split('\n\n').map((p, i) => (
                  <p key={i} className={section.bodyClass ?? 'note-body'}>{p}</p>
                ))}
              </section>
            )}
            {si < note.content.length - 1 && (
              <div key={`img-${section.id}`} className="note-image-wrap">
                <div className="note-image-inner">
                  {si === 0
                    ? <img src="/tumblr_8b97eed4e22307c56b8c51612a492c87_8b2d8fbc_540.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 1
                    ? <img src="/frieren.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 2
                    ? <img src="/vinland.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : si === 3
                    ? <img src="/boji.gif" alt="" className="note-image-placeholder" style={{ objectFit: 'cover' }} />
                    : <div className="note-image-placeholder" />}
                  <div className="grain-overlay" />
                </div>
                {section.caption && (
                  <p className="note-image-caption">
                    {section.captionPrefix}{section.captionHref
                      ? <a href={section.captionHref} target="_blank" rel="noreferrer">{section.caption}</a>
                      : section.caption}
                  </p>
                )}
              </div>
            )}
          </>
        ))}
      </article>
    </div>
  )
}


function WritingPage({ setPage }) {
  const [activeNote, setActiveNote] = useState(null)

  if (activeNote) {
    return (
      <div key={activeNote.title} className="page-transition">
        <NoteDetailPage note={activeNote} onBack={() => setActiveNote(null)} />
      </div>
    )
  }

  return (
    <div className="page">
      <Nav page="writing" setPage={setPage} />
      <div className="page-content">
        <h1 className="page-heading animate" style={{ animationDelay: '0.1s' }}>A collection of thoughts, ideas, and observations</h1>
        <ul className="projects no-bg-hover" style={{ width: '100%' }}>
          {writings.map((w, i) => (
            <li key={w.title} className="project animate" style={{ animationDelay: `${0.1 + i * 0.05}s`, cursor: 'pointer' }} onClick={() => setActiveNote(w)}>
              <span className="project-year">{w.year}</span>
              <span className="project-name">{w.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState('work')

  return (
    <div key={page} className="page-transition">
      {page === 'work'         && <WorkPage         setPage={setPage} />}
      {page === 'about'        && <AboutPage        setPage={setPage} />}
      {page === 'writing'      && <WritingPage      setPage={setPage} />}
      {/* <Agentation /> */}
    </div>
  )
}
