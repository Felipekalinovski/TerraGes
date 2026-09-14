import { supabase } from './supabaseClient';
import { uploadPrivateFile, resolvePrivateFile } from './storageService';
export interface CompanyProfile { id:string; name:string; cnpj?:string; address?:string; website?:string; logo_url?:string; created_at?:string; updated_at?:string; }
async function currentCompany() {
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) throw new Error('Entre na sua conta.');
  const {data:profile,error} = await supabase.from('profiles').select('company_id').eq('id',user.id).single();
  if (error || !profile?.company_id) throw new Error('Empresa não vinculada.');
  return profile.company_id;
}
export const companyService = {
  async getCompanyProfile(): Promise<CompanyProfile | null> {
    try {
      const id = await currentCompany();
      const {data,error} = await supabase.from('company_info').select('*').eq('id',id).single();
      if (error) throw error;
      return {...data.settings,id:data.id,name:data.name,logo_url:await resolvePrivateFile(data.settings?.logo_url)};
    } catch { return null; }
  },
  async updateCompanyProfile(updates: Partial<CompanyProfile>): Promise<{success:boolean;error?:string}> {
    try {
      const id = await currentCompany();
      const {data,error:readError} = await supabase.from('company_info').select('settings').eq('id',id).single();
      if (readError) throw readError;
      const settings = {...data.settings};
      for (const key of ['cnpj','address','website','logo_url'] as const) {
        if (updates[key] !== undefined && !(key === 'logo_url' && updates[key]?.startsWith('https:'))) settings[key] = updates[key];
      }
      const {error} = await supabase.from('company_info').update({...(updates.name !== undefined ? {name:updates.name} : {}),settings}).eq('id',id).select('id').single();
      if (error) throw error;
      return {success:true};
    } catch(e:any) { return {success:false,error:e.message}; }
  },
  async uploadLogo(file:File): Promise<{success:boolean;url?:string;error?:string}> {
    try {
      const reference = await uploadPrivateFile('company-logos',file);
      const result = await this.updateCompanyProfile({logo_url:reference});
      if (!result.success) throw new Error(result.error);
      return {success:true,url:await resolvePrivateFile(reference)};
    } catch(e:any) { return {success:false,error:e.message}; }
  }
};
