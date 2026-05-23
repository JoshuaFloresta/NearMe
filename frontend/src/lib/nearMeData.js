export const APP_NAME = 'Near Me';
export const APP_TAGLINE = 'Reliable Help, Made Easy';

export const SERVICES = [
  { id: 'plumbing', label: 'Plumbing', icon: '🔧', color: 'bg-bauhaus-blue' },
  { id: 'cleaning', label: 'House Cleaning', icon: '✨', color: 'bg-bauhaus-red' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', color: 'bg-bauhaus-yellow' },
  { id: 'mechanic', label: 'Mechanic', icon: '🚗', color: 'bg-bauhaus-blue' },
  { id: 'carpentry', label: 'Carpentry', icon: '🔨', color: 'bg-bauhaus-red' },
  { id: 'delivery', label: 'Delivery', icon: '📦', color: 'bg-bauhaus-yellow' },
  { id: 'painting', label: 'Painting', icon: '🎨', color: 'bg-bauhaus-blue' },
  { id: 'gardening', label: 'Gardening', icon: '🌿', color: 'bg-bauhaus-red' },
  { id: 'appliance', label: 'Appliance Repair', icon: '🔌', color: 'bg-bauhaus-yellow' },
  { id: 'other', label: 'Other Services', icon: '⚙️', color: 'bg-bauhaus-ink text-white' },
];

export const MOCK_PROVIDERS = [
  {
    id: 1,
    name: 'Mario Santos',
    service: 'Plumbing',
    rating: 4.9,
    jobs: 214,
    location: 'Quezon City',
    rate: 450,
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 2,
    name: 'Ana Reyes',
    service: 'House Cleaning',
    rating: 4.8,
    jobs: 176,
    location: 'Makati',
    rate: 380,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=160&q=80',
  },
  {
    id: 3,
    name: 'Luis Dela Cruz',
    service: 'Electrical',
    rating: 4.9,
    jobs: 142,
    location: 'Pasig',
    rate: 520,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&q=80',
  },
];

export const TESTIMONIALS = [
  {
    name: 'Patricia Lim',
    location: 'Taguig',
    service: 'Cleaning',
    rating: 5,
    text: 'Booked in the morning and had my condo cleaned by lunch. Super smooth experience.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=80',
  },
  {
    name: 'Jose Garcia',
    location: 'Manila',
    service: 'Plumbing',
    rating: 5,
    text: 'The provider arrived on time, explained the issue clearly, and fixed the leak fast.',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80',
  },
  {
    name: 'Mika Flores',
    location: 'Mandaluyong',
    service: 'Electrical',
    rating: 4.8,
    text: 'Easy to compare providers and rates. I found someone reliable in my area right away.',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
  },
];
