import React, {createContext,useContext,useEffect,useRef,useState} from 'react';
import {Session,User} from '@supabase/supabase-js';
import {supabase} from '../services/supabaseClient';
import {userService,UserProfile} from '../services/userService';
interface AuthContextType {session:Session|null;user:User|null;profile:UserProfile|null;loading:boolean;signOut:()=>Promise<void>;refreshProfile:()=>Promise<void>;}
export const AuthContext=createContext<AuthContextType>({session:null,user:null,profile:null,loading:true,signOut:async()=>{},refreshProfile:async()=>{}});
export const AuthProvider:React.FC<{children:React.ReactNode}>=({children})=>{
  const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<UserProfile|null>(null),[loading,setLoading]=useState(true);
  const generation=useRef(0);
  useEffect(()=>{
    let disposed=false;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      const version=++generation.current;
      setSession(next);setProfile(null);setLoading(Boolean(next));
      if(next) {
        // Leave the auth callback before making SDK calls (avoids the auth lock).
        setTimeout(async()=>{
          const loaded=await userService.getCurrentProfile();
          if(!disposed&&version===generation.current){setProfile(loaded?.id===next.user.id?loaded:null);setLoading(false);}
        },0);
      }
    });
    return ()=>{disposed=true;++generation.current;subscription.unsubscribe();};
  },[]);
  const refreshProfile=async()=>{
    const version=generation.current;
    const loaded=await userService.getCurrentProfile();
    if(version===generation.current)setProfile(loaded);
  };
  const signOut=async()=>{++generation.current;setProfile(null);await supabase.auth.signOut();};
  return <AuthContext.Provider value={{session,user:session?.user??null,profile,loading,signOut,refreshProfile}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>useContext(AuthContext);
