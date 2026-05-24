/* Shared styling, lifted unchanged from the original prototype. */

export const THEME = {
  1: { name: 'Coral', solid: 'linear-gradient(158deg,#ea8763,#cd5538)', flat: '#d96245', soft: 'rgba(217,98,69,0.5)' },
  2: { name: 'Teal',  solid: 'linear-gradient(158deg,#56b1a6,#2a8378)', flat: '#2f8c80', soft: 'rgba(47,140,128,0.5)' },
};

export const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Nunito+Sans:wght@400;600;700;800&display=swap');
  @keyframes gl-pop { 0%{transform:scale(0.45);} 70%{transform:scale(1.08);} 100%{transform:scale(1);} }
  @keyframes gl-flash { 0%{filter:brightness(1);} 45%{filter:brightness(2.4);} 100%{filter:brightness(1);opacity:0;transform:scale(0.6);} }
  @keyframes gl-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(208,72,60,0.55);} 50%{box-shadow:0 0 0 7px rgba(208,72,60,0);} }
  @keyframes gl-rise { from{opacity:0;transform:translateY(10px);} to{opacity:1;transform:translateY(0);} }
  @keyframes gl-score { 0%{opacity:0;transform:translateY(6px) scale(0.8);} 20%{opacity:1;transform:translateY(0) scale(1.05);} 75%{opacity:1;} 100%{opacity:0;transform:translateY(-20px) scale(1);} }
  * { -webkit-tap-highlight-color: transparent; }
`;

export const page = {
  fontFamily: "'Nunito Sans', sans-serif",
  minHeight: '100%',
  background: 'radial-gradient(120% 80% at 50% 0%, #f6ead0 0%, #ecd9b2 100%)',
  color: '#3a3025',
  padding: '18px 14px 40px',
  boxSizing: 'border-box',
};

export const card = {
  background: '#fcf6e8',
  border: '1px solid #e2cfa3',
  borderRadius: 16,
  boxShadow: '0 6px 20px rgba(120,90,40,0.12)',
};

export const display = { fontFamily: "'Fraunces', serif" };
