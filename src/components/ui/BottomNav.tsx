import homeIcon from '../../assets/tab_home.png';
import practiceIcon from '../../assets/tab_practice.png';
import storiesIcon from '../../assets/tab_stories.png';
import chatIcon from '../../assets/tab_chat.png';
import profileIcon from '../../assets/tab_profile.png';

export default function BottomNav({ active, onNav }: { active: string; onNav: (name: string) => void }) {
  const items = [
    { name: 'home', icon: homeIcon, label: 'Learn' },
    { name: 'practice', icon: practiceIcon, label: 'Review' },
    { name: 'stories', icon: storiesIcon, label: 'Stories' },
    { name: 'chat', icon: chatIcon, label: 'Bot' },
    { name: 'profile', icon: profileIcon, label: 'Profile' },
  ];
  
  return (
    <nav className="bottom-nav">
      {items.map(i => (
        <button key={i.name} className={`nav-btn ${active === i.name ? 'active' : ''}`} onClick={() => onNav(i.name)}>
          <img src={i.icon} alt={i.label} className="nav-icon-img" />
          <span className="nav-label">{i.label}</span>
        </button>
      ))}
    </nav>
  );
}
