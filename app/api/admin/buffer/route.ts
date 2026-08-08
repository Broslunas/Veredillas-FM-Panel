import { NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/api-guard';

export async function GET(request: Request) {
  try {
    const { authorized } = await isAuthorizedAdmin(request);
    if (!authorized) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const BUFFER_TOKEN = process.env.BUFFER_ACCESS_TOKEN || '';

    if (!BUFFER_TOKEN) {
      return NextResponse.json({
        configured: false,
        error: 'No se encontró el Token de Buffer en las variables de entorno (BUFFER_ACCESS_TOKEN).',
        profiles: [],
        scheduledPosts: [],
      });
    }

    const orgQuery = `
      query {
        account {
          organizations {
            id
            channels { id name service formatted_username: name }
          }
        }
      }`;

    const orgRes = await fetch('https://api.buffer.com/1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BUFFER_TOKEN}`,
      },
      body: JSON.stringify({ query: orgQuery }),
    });

    const orgData = await orgRes.json();

    if (orgData.errors) {
      return NextResponse.json({
        configured: true,
        error: `Error GraphQL (Organización): ${orgData.errors[0].message}`,
        profiles: [],
        scheduledPosts: [],
      });
    }

    const org = orgData.data?.account?.organizations?.[0];
    if (!org) {
      return NextResponse.json({
        configured: true,
        error: 'No se encontró una organización en la cuenta de Buffer.',
        profiles: [],
        scheduledPosts: [],
      });
    }

    const profiles = org.channels || [];
    const orgId = org.id;

    const postsQuery = `
      query GetPosts($orgId: OrganizationId!) {
        posts(input: { organizationId: $orgId, filter: { status: scheduled } }, first: 40) {
          edges {
            node {
              id
              text
              dueAt
              channel { id service name }
            }
          }
        }
      }`;

    const postsRes = await fetch('https://api.buffer.com/1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BUFFER_TOKEN}`,
      },
      body: JSON.stringify({ query: postsQuery, variables: { orgId } }),
    });

    const postsData = await postsRes.json();

    if (postsData.errors) {
      return NextResponse.json({
        configured: true,
        error: `Error GraphQL (Posts): ${postsData.errors[0].message}`,
        profiles,
        scheduledPosts: [],
      });
    }

    const edges = postsData.data?.posts?.edges || [];
    const scheduledPosts = edges.map((edge: any) => ({
      id: edge.node.id,
      text: edge.node.text,
      due_at: edge.node.dueAt,
      _profile: edge.node.channel,
    }));

    scheduledPosts.sort(
      (a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime()
    );

    return NextResponse.json({
      configured: true,
      error: null,
      profiles,
      scheduledPosts: scheduledPosts.slice(0, 40),
    });
  } catch (error: any) {
    console.error('Error fetching Buffer data:', error);
    return NextResponse.json({
      configured: false,
      error: error.message || 'Error de conexión con la API de Buffer',
      profiles: [],
      scheduledPosts: [],
    }, { status: 500 });
  }
}
