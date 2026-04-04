-- Ativação do RLS para a tabela de 'machines'
-- Isso garante que as políticas já definidas para a tabela funcionem, e que os usuários só vejam seus equipamentos.
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
