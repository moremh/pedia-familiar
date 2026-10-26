import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    },
  )
}

async function collectStorageFiles(
  admin: ReturnType<typeof createClient>,
  prefix: string,
): Promise<string[]> {
  const bucket =
    admin.storage.from('medical-files')

  const { data, error } =
    await bucket.list(prefix, {
      limit: 1000,
      sortBy: {
        column: 'name',
        order: 'asc',
      },
    })

  if (error) {
    throw error
  }

  const files: string[] = []

  for (const item of data || []) {
    const path = prefix
      ? `${prefix}/${item.name}`
      : item.name

    if (item.id) {
      files.push(path)
      continue
    }

    files.push(
      ...await collectStorageFiles(
        admin,
        path,
      ),
    )
  }

  return files
}

async function removeFamilyFiles(
  admin: ReturnType<typeof createClient>,
  familyId: string,
) {
  const paths =
    await collectStorageFiles(
      admin,
      familyId,
    )

  for (
    let index = 0;
    index < paths.length;
    index += 100
  ) {
    const chunk =
      paths.slice(index, index + 100)

    const { error } =
      await admin.storage
        .from('medical-files')
        .remove(chunk)

    if (error) {
      throw error
    }
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        message: 'Método no permitido.',
      },
      405,
    )
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY
  ) {
    return jsonResponse(
      {
        ok: false,
        message:
          'La función de eliminación no está configurada.',
      },
      500,
    )
  }

  const authorization =
    request.headers.get('Authorization') || ''

  if (!authorization) {
    return jsonResponse(
      {
        ok: false,
        message: 'La sesión no es válida.',
      },
      401,
    )
  }

  const userClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(
      {
        ok: false,
        message:
          'La sesión terminó. Volvé a iniciar sesión.',
      },
      401,
    )
  }

  const admin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    const {
      data: membership,
      error: membershipError,
    } = await admin
      .from('family_members')
      .select(
        'id, family_id, member_role, status',
      )
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (membershipError) {
      throw membershipError
    }

    if (
      membership?.member_role === 'owner'
    ) {
      const {
        count,
        error: membersError,
      } = await admin
        .from('family_members')
        .select('id', {
          count: 'exact',
          head: true,
        })
        .eq(
          'family_id',
          membership.family_id,
        )
        .eq('status', 'active')
        .neq('user_id', user.id)

      if (membersError) {
        throw membersError
      }

      if ((count || 0) > 0) {
        return jsonResponse({
          ok: false,
          message:
            'No podés eliminar la cuenta principal mientras existan otros responsables con acceso activo. Revocá esos accesos o comunicate con administración.',
        })
      }

      await removeFamilyFiles(
        admin,
        membership.family_id,
      )

      const { error: familyError } =
        await admin
          .from('families')
          .delete()
          .eq(
            'id',
            membership.family_id,
          )

      if (familyError) {
        throw familyError
      }
    } else if (membership) {
      const { error: caregiverError } =
        await admin
          .from('caregivers')
          .update({
            has_system_access: false,
            invitation_status: 'revoked',
          })
          .eq('user_id', user.id)

      if (caregiverError) {
        throw caregiverError
      }
    }

    const {
      error: deleteUserError,
    } =
      await admin.auth.admin.deleteUser(
        user.id,
      )

    if (deleteUserError) {
      throw deleteUserError
    }

    return jsonResponse({
      ok: true,
      message:
        'La cuenta fue eliminada.',
    })
  } catch (error) {
    console.error(
      'Delete account error:',
      error,
    )

    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar la cuenta.',
      },
      500,
    )
  }
})
