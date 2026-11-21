# NextStep review rules

Reject a change that:

- Opens a desk plan without a completed Stripe checkout.
- Starts the $40 Basic monthly trial without `payment_method_collection=always`, or without canceling the trial when no card is on file.
- Gives Premium or Premium Plus a free trial. Those charge immediately.
- Lets a `past_due`, `unpaid`, or deleted subscription keep the desk open.
- Fills Facebook and stops on vehicle type, year, VIN, or exterior color.
- Marks the whole lot sold from a partial dealer page.
- Adds texting, a new plan tier, or another caption style.

The guards that must keep passing: dealer pull fixtures, Facebook fill fixtures, and Stripe checkout and webhook cases.
