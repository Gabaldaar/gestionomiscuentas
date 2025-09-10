import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { wallets } from "@/lib/data";
import { ArrowRightLeft } from "lucide-react";

export default function TransfersPage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <PageHeader title="Fund Transfers" />
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              New Transfer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-wallet">From Wallet</Label>
                <Select>
                  <SelectTrigger id="from-wallet">
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(wallet => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-wallet">To Wallet</Label>
                <Select>
                  <SelectTrigger id="to-wallet">
                    <SelectValue placeholder="Select a wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map(wallet => (
                      <SelectItem key={wallet.id} value={wallet.id}>
                        {wallet.name} ({wallet.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="amount-sent">Amount Sent</Label>
                    <Input id="amount-sent" type="number" placeholder="0.00" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="amount-received">Amount Received</Label>
                    <Input id="amount-received" type="number" placeholder="0.00" />
                </div>
            </div>

             <div className="space-y-2">
                <Label htmlFor="exchange-rate">Exchange Rate</Label>
                <Input id="exchange-rate" type="number" placeholder="1 USD = 900 ARS" />
             </div>
            
            <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Optional notes about the transfer" />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full">
                Complete Transfer
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
