import { json, type ActionFunctionArgs } from '@remix-run/cloudflare';

const SSO_SECRET = 'HWf7tBsb6GbypgU77aiUXtfQfsUTr0AEOvFeTl1e';

type ValidateTokenBody = {
  token?: string;
  source?: string;
};

export async function action({ request }: ActionFunctionArgs) {
  const { token, source } = (await request.json()) as ValidateTokenBody;

  if (!token || !source) {
    return json({ valid: false, message: 'Missing required parameters.' }, { status: 400 });
  }

  try {
    const externalRes = await fetch('https://createstudio.app/api/sso/validate-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SSO-Secret': SSO_SECRET,
      },
      body: JSON.stringify({ token, source }),
    });

    const data = await externalRes.json();

    return json(data, { status: externalRes.status });
  } catch (err) {
    console.error('SSO Validate Token API Error:', err);

    return json({ valid: false, message: 'Something went wrong while validating the token.' }, { status: 500 });
  }
}
