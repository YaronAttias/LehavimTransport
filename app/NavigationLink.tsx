import type {ReactNode} from 'react';
import type {View} from './navigation';
export default function NavigationLink({view,week,children,className='',label,current}:{view:View;week:string;onNavigate:()=>void;children:ReactNode;className?:string;label?:string;current?:boolean}){
 const href='/?'+new URLSearchParams({view,week}).toString();
 return <a href={href} className={'navigation-link '+className} aria-label={label} aria-current={current?'page':undefined}>{children}</a>;
}
