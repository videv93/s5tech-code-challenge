# S5 Tech / 99Tech Code Challenge

Source: https://s5tech.notion.site/Code-Challenge-05cdb9e0d1ce432a843f763b5d5f7497
Skeleton repo: https://github.com/99techteam/code-challenge

## Instructions
1. Submit your application along with the solutions attached or linked.
2. Each problem provides sufficient information to attempt the challenge. Note uncertainties and declare assumptions in your solution.
3. It is important that you minimally attempt the problems, even if you do not arrive at a working solution.
4. The challenge is broad/freeform — exercise creativity where constraints are not clear.
5. Start with the skeletal template in the GitHub repo. Provide a link to an online repo (no zip files). Depending on the role, you may only need selected problems.

---

## Problem 1: Three ways to sum to n
*Duration: max 2 hours (internship estimate; professionals should take less).*

Provide 3 unique implementations of the following function in **JavaScript**.

- Input: `n` — any integer. Assume the input always produces a result less than `Number.MAX_SAFE_INTEGER`.
- Output: summation to n, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.

```javascript
var sum_to_n_a = function(n) {
    // your code here
};

var sum_to_n_b = function(n) {
    // your code here
};

var sum_to_n_c = function(n) {
    // your code here
};
```

---

## Problem 2: Fancy Form
*Duration: max 16 hours.*

Create a currency swap form based on the template provided in the folder. A user would use this form to swap assets from one currency to another. You may use any third party plugin, library, and/or framework.

1. You may add input validation/error messages to make the form interactive.
2. Your submission will be rated on its usage intuitiveness and visual attractiveness.
3. Show us your frontend development and design skills — feel free to totally disregard the provided files for this problem.
4. Token images: https://github.com/Switcheo/token-icons/tree/main/tokens (e.g. https://raw.githubusercontent.com/Switcheo/token-icons/main/tokens/SWTH.svg)
5. Token prices / exchange rates: https://interview.switcheo.com/prices.json (tokens without a price may be omitted).

**Bonus:** extra points for using Vite (https://vite.dev/).

Submit using the files provided in the skeletal repo, including any additional files your solution uses.

**Hint:** feel free to simulate or mock backend interactions, e.g. a loading indicator with a timeout delay on the submit button is good enough.

---

## Problem 3: Messy React
*Duration: max 6 hours.*

List out the computational inefficiencies and anti-patterns found in the code block below.

1. This code block uses ReactJS with TypeScript, functional components, and React Hooks.
2. You should also provide a refactored version of the code, but more points are awarded to accurately stating the issues and explaining correctly how to improve them.

```tsx
interface WalletBalance {
  currency: string;
  amount: number;
}
interface FormattedWalletBalance {
  currency: string;
  amount: number;
  formatted: string;
}

interface Props extends BoxProps {

}
const WalletPage: React.FC<Props> = (props: Props) => {
  const { children, ...rest } = props;
  const balances = useWalletBalances();
  const prices = usePrices();

	const getPriority = (blockchain: any): number => {
	  switch (blockchain) {
	    case 'Osmosis':
	      return 100
	    case 'Ethereum':
	      return 50
	    case 'Arbitrum':
	      return 30
	    case 'Zilliqa':
	      return 20
	    case 'Neo':
	      return 20
	    default:
	      return -99
	  }
	}

  const sortedBalances = useMemo(() => {
    return balances.filter((balance: WalletBalance) => {
		  const balancePriority = getPriority(balance.blockchain);
		  if (lhsPriority > -99) {
		     if (balance.amount <= 0) {
		       return true;
		     }
		  }
		  return false
		}).sort((lhs: WalletBalance, rhs: WalletBalance) => {
			const leftPriority = getPriority(lhs.blockchain);
		  const rightPriority = getPriority(rhs.blockchain);
		  if (leftPriority > rightPriority) {
		    return -1;
		  } else if (rightPriority > leftPriority) {
		    return 1;
		  }
    });
  }, [balances, prices]);

  const formattedBalances = sortedBalances.map((balance: WalletBalance) => {
    return {
      ...balance,
      formatted: balance.amount.toFixed()
    }
  })

  const rows = sortedBalances.map((balance: FormattedWalletBalance, index: number) => {
    const usdValue = prices[balance.currency] * balance.amount;
    return (
      <WalletRow 
        className={classes.row}
        key={index}
        amount={balance.amount}
        usdValue={usdValue}
        formattedAmount={balance.formatted}
      />
    )
  })

  return (
    <div {...rest}>
      {rows}
    </div>
  )
}
```

---

## Problem 4: Three ways to sum to n
*Duration: max 2 hours.*

Provide 3 unique implementations of the following function in **TypeScript**.

- Comment on the complexity or efficiency of each function.
- Input: `n` — any integer. Assume the input always produces a result less than `Number.MAX_SAFE_INTEGER`.
- Output: summation to n, i.e. `sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15`.

```ts
// (as printed on the page, with `func` instead of `function`)
func sum_to_n_a(n: number): number {
	// your code here
}

func sum_to_n_b(n: number): number {
	// your code here
}

func sum_to_n_c(n: number): number {
	// your code here
}
```

---

## Problem 5: A Crude Server
*Duration: max 16 hours.*

Develop a backend server with **ExpressJS**. Build a set of CRUD interfaces that allow a user to interact with the service. **TypeScript is required.**

1. Interface functionalities:
   1. Create a resource.
   2. List resources with basic filters.
   3. Get details of a resource.
   4. Update resource details.
   5. Delete a resource.
2. Connect your backend service with a simple database for data persistence.
3. Provide a `README.md` for the configuration and how to run the application.

---

## Problem 6: Architecture
*Duration: max 8 hours.*

Write the specification for a software module on the API service (backend application server).

1. Create documentation for this module in a `README.md` file.
2. Create a diagram to illustrate the flow of execution.
3. Add additional comments for improvements you may have in the documentation.
4. Your specification will be given to a backend engineering team to implement.

### Software Requirements
1. We have a website with a score board, which shows the top 10 users' scores.
2. We want live update of the score board.
3. A user can do an action (we do not need to care what the action is); completing it increases the user's score.
4. Upon completion the action dispatches an API call to the application server to update the score.
5. We want to prevent malicious users from increasing scores without authorisation.
