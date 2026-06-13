import os

from plaid import Configuration, ApiClient, Environment
from plaid.api import plaid_api
from plaid.model.country_code import CountryCode
from plaid.model.products import Products
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.investments_holdings_get_request import InvestmentsHoldingsGetRequest
from plaid.model.accounts_balance_get_request import AccountsBalanceGetRequest
from plaid.model.item_get_request import ItemGetRequest
from plaid.model.transactions_sync_request import TransactionsSyncRequest


def _plaid_env():
    env = (os.getenv('PLAID_ENV') or 'sandbox').lower()
    if env == 'production':
        return Environment.Production
    # plaid-python only exposes Sandbox and Production (no Development)
    return Environment.Sandbox


def get_plaid_client() -> plaid_api.PlaidApi:
    client_id = os.getenv('PLAID_CLIENT_ID')
    secret = os.getenv('PLAID_SECRET')
    if not client_id or not secret:
        raise ValueError('PLAID_CLIENT_ID and PLAID_SECRET must be set in .env')
    configuration = Configuration(
        host=_plaid_env(),
        api_key={'clientId': client_id, 'secret': secret},
    )
    return plaid_api.PlaidApi(ApiClient(configuration))


def _to_dict(response):
    return response.to_dict() if hasattr(response, 'to_dict') else dict(response)


def create_link_token(client_user_id: str, access_token: str | None = None) -> str:
    client = get_plaid_client()
    user = LinkTokenCreateRequestUser(client_user_id=client_user_id)
    kwargs = {
        'client_name': 'Capybara Portfolio',
        'country_codes': [CountryCode('US')],
        'language': 'en',
        'user': user,
    }
    if access_token:
        kwargs['access_token'] = access_token
    else:
        kwargs['products'] = [Products('investments'), Products('transactions')]

    redirect_uri = os.getenv('PLAID_REDIRECT_URI')
    if redirect_uri:
        kwargs['redirect_uri'] = redirect_uri

    webhook = os.getenv('PLAID_WEBHOOK_URL')
    if webhook:
        kwargs['webhook'] = webhook

    request = LinkTokenCreateRequest(**kwargs)
    response = client.link_token_create(request)
    return response['link_token']


def exchange_public_token(public_token: str) -> tuple[str, str]:
    client = get_plaid_client()
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return response['access_token'], response['item_id']


def get_item(access_token: str) -> dict:
    client = get_plaid_client()
    response = client.item_get(ItemGetRequest(access_token=access_token))
    return _to_dict(response)


def get_holdings(access_token: str) -> dict:
    client = get_plaid_client()
    response = client.investments_holdings_get(
        InvestmentsHoldingsGetRequest(access_token=access_token)
    )
    return _to_dict(response)


def get_balances(access_token: str) -> dict:
    client = get_plaid_client()
    response = client.accounts_balance_get(
        AccountsBalanceGetRequest(access_token=access_token)
    )
    return _to_dict(response)


def sync_transactions(access_token: str, cursor: str | None = None) -> dict:
    client = get_plaid_client()
    response = client.transactions_sync(
        TransactionsSyncRequest(
            access_token=access_token,
            cursor=cursor or '',
        )
    )
    return _to_dict(response)
