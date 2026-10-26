import type {Metadata} from 'next';
import KidsBoard from './KidsBoard';

export const metadata:Metadata={title:'עולים למגרש ⚽ | גבעות בר',description:'האימונים, המשחקים וההסעות שלנו השבוע',robots:{index:false,follow:false}};
export default function KidsPage(){return <KidsBoard/>}
