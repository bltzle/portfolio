export default function ProjectCard({ name, desc, img, fallback, dimmed, onEnter, onLeave }) {
  return (
    <div
      className={['project-card', dimmed && 'dimmed'].filter(Boolean).join(' ')}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div className="card">
        <img src={img} alt={name} onError={e => { e.target.src = fallback }} />
        <div className="card-info">
          <span className="card-name">{name}</span>
          <span className="card-desc">{desc}</span>
        </div>
      </div>
    </div>
  )
}
