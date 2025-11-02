"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useVaultTransferOwnership, useVaultRenounceOwnership } from "@/hooks"

interface OwnershipManagementProps {
  currentOwner?: string
  isOwner: boolean
}

export default function OwnershipManagement({ currentOwner, isOwner }: OwnershipManagementProps) {
  const [newOwnerAddress, setNewOwnerAddress] = useState("")
  const [showTransferConfirmation, setShowTransferConfirmation] = useState(false)
  const [showRenounceConfirmation, setShowRenounceConfirmation] = useState(false)
  const [renounceConfirmationText, setRenounceConfirmationText] = useState("")
  const [renounceAddressText, setRenounceAddressText] = useState("")
  const [renounceCheckbox, setRenounceCheckbox] = useState(false)

  const { 
    transferOwnership, 
    isPending: isTransferPending, 
    isConfirming: isTransferConfirming, 
    isConfirmed: isTransferConfirmed, 
    error: transferError, 
    hash: transferHash 
  } = useVaultTransferOwnership()

  const { 
    renounceOwnership, 
    isPending: isRenouncePending, 
    isConfirming: isRenounceConfirming, 
    isConfirmed: isRenounceConfirmed, 
    error: renounceError, 
    hash: renounceHash 
  } = useVaultRenounceOwnership()

  const isValidAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  const handleTransferOwnership = async () => {
    if (!showTransferConfirmation || !isValidAddress(newOwnerAddress)) {
      return
    }

    try {
      await transferOwnership(newOwnerAddress as `0x${string}`)
      
      if (isTransferConfirmed) {
        setNewOwnerAddress("")
        setShowTransferConfirmation(false)
      }
    } catch (err) {
      console.error('Ownership transfer failed:', err)
    }
  }

  const handleRenounceOwnership = async () => {
    if (!showRenounceConfirmation || 
        renounceConfirmationText !== "RENOUNCE" || 
        renounceAddressText !== currentOwner ||
        !renounceCheckbox) {
      return
    }

    try {
      await renounceOwnership()
      
      if (isRenounceConfirmed) {
        setRenounceConfirmationText("")
        setRenounceAddressText("")
        setRenounceCheckbox(false)
        setShowRenounceConfirmation(false)
      }
    } catch (err) {
      console.error('Renounce ownership failed:', err)
    }
  }

  const canTransfer = showTransferConfirmation && isValidAddress(newOwnerAddress) && !isTransferPending && !isTransferConfirming
  const canRenounce = showRenounceConfirmation && 
                     renounceConfirmationText === "RENOUNCE" && 
                     renounceAddressText === currentOwner &&
                     renounceCheckbox &&
                     !isRenouncePending && 
                     !isRenounceConfirming

  return (
    <div className="space-y-6">
      {/* Current Ownership Info */}
      <Card className="bg-card border-border p-6">
        <h2 className="text-xl font-bold text-foreground mb-4">Current Ownership</h2>
        <div className="bg-muted rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm uppercase tracking-wide mb-1">Owner Address</p>
              <p className="text-foreground font-mono text-sm break-all">{currentOwner || "Unknown"}</p>
            </div>
            <Button
              onClick={() => navigator.clipboard.writeText(currentOwner || "")}
              variant="outline"
              size="sm"
            >
              Copy
            </Button>
          </div>
        </div>
      </Card>

      {/* Transfer Ownership */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Transfer Ownership</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground text-sm uppercase tracking-wide mb-2 block">
              New Owner Address
            </label>
            <input
              type="text"
              value={newOwnerAddress}
              onChange={(e) => setNewOwnerAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-background border border-border rounded px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {newOwnerAddress && !isValidAddress(newOwnerAddress) && (
              <p className="text-destructive text-xs mt-1">Invalid Ethereum address format</p>
            )}
            {newOwnerAddress && isValidAddress(newOwnerAddress) && (
              <p className="text-primary text-xs mt-1">✓ Valid address format</p>
            )}
          </div>

          {!showTransferConfirmation ? (
            <Button
              onClick={() => setShowTransferConfirmation(true)}
              disabled={!isValidAddress(newOwnerAddress) || !isOwner || newOwnerAddress.toLowerCase() === currentOwner?.toLowerCase()}
              className="w-full bg-orange-600 hover:bg-orange-700 text-background font-semibold py-3"
            >
              {!isOwner ? "Owner Access Required" : 
               newOwnerAddress.toLowerCase() === currentOwner?.toLowerCase() ? "Cannot Transfer to Self" :
               "Initiate Ownership Transfer"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded p-4">
                <h4 className="text-orange-600 font-semibold mb-2">Transfer Ownership Confirmation</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-orange-600">
                    <strong>Current Owner:</strong> {currentOwner}
                  </p>
                  <p className="text-orange-600">
                    <strong>New Owner:</strong> {newOwnerAddress}
                  </p>
                  <p className="text-orange-600 text-xs mt-2">
                    ⚠️ This action will transfer all administrative privileges to the new owner.
                    You will lose access to admin functions after the transfer.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowTransferConfirmation(false)
                    setNewOwnerAddress("")
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTransferOwnership}
                  disabled={!canTransfer}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-background font-semibold"
                >
                  {isTransferPending || isTransferConfirming ? "Processing..." : "Transfer Ownership"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Transfer Status */}
        {transferError && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-semibold mb-1">Ownership Transfer Failed</p>
            <p className="text-destructive text-xs">{transferError.message}</p>
          </div>
        )}

        {isTransferConfirmed && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded text-sm">
            <p className="text-primary font-semibold mb-1">✓ Ownership Transfer Successful</p>
            <p className="text-primary text-xs">Ownership transferred to {newOwnerAddress}</p>
            {transferHash && (
              <p className="text-primary text-xs mt-1">
                TX: {transferHash.slice(0, 10)}...{transferHash.slice(-8)}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Renounce Ownership */}
      <Card className="bg-red-500/10 border-red-500/20 p-6">
        <h3 className="text-lg font-bold text-red-600 mb-4">Renounce Ownership</h3>
        
        <div className="space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
            <h4 className="text-red-600 font-semibold mb-2">⚠️ CRITICAL WARNING</h4>
            <ul className="text-red-600 text-sm space-y-1">
              <li>• This action is <strong>IRREVERSIBLE</strong></li>
              <li>• You will permanently lose all administrative privileges</li>
              <li>• No one will be able to perform admin functions</li>
              <li>• Emergency controls will be permanently disabled</li>
              <li>• This action cannot be undone</li>
            </ul>
          </div>

          {!showRenounceConfirmation ? (
            <Button
              onClick={() => setShowRenounceConfirmation(true)}
              disabled={!isOwner}
              className="w-full bg-red-600 hover:bg-red-700 text-background font-semibold py-3"
            >
              {!isOwner ? "Owner Access Required" : "Initiate Renounce Ownership"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded p-4">
                <h4 className="text-red-600 font-semibold mb-3">Final Confirmation Required</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-red-600 text-sm font-semibold">
                      Type your current address to confirm:
                    </label>
                    <input
                      type="text"
                      value={renounceAddressText}
                      onChange={(e) => setRenounceAddressText(e.target.value)}
                      placeholder={currentOwner}
                      className="w-full bg-background border border-red-500/30 rounded px-3 py-2 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mt-1"
                    />
                    {renounceAddressText !== currentOwner && renounceAddressText && (
                      <p className="text-destructive text-xs mt-1">Address does not match current owner</p>
                    )}
                  </div>

                  <div>
                    <label className="text-red-600 text-sm font-semibold">
                      Type "RENOUNCE" to confirm:
                    </label>
                    <input
                      type="text"
                      value={renounceConfirmationText}
                      onChange={(e) => setRenounceConfirmationText(e.target.value)}
                      placeholder="RENOUNCE"
                      className="w-full bg-background border border-red-500/30 rounded px-3 py-2 text-foreground font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="renounce-checkbox"
                      checked={renounceCheckbox}
                      onChange={(e) => setRenounceCheckbox(e.target.checked)}
                      className="w-4 h-4 text-red-600 bg-background border-red-500 rounded focus:ring-red-500"
                    />
                    <label htmlFor="renounce-checkbox" className="text-red-600 text-sm">
                      I understand this action is irreversible and will permanently remove all admin privileges
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowRenounceConfirmation(false)
                    setRenounceConfirmationText("")
                    setRenounceAddressText("")
                    setRenounceCheckbox(false)
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRenounceOwnership}
                  disabled={!canRenounce}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-background font-semibold"
                >
                  {isRenouncePending || isRenounceConfirming ? "Processing..." : "Renounce Ownership"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Renounce Status */}
        {renounceError && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm">
            <p className="text-destructive font-semibold mb-1">Renounce Ownership Failed</p>
            <p className="text-destructive text-xs">{renounceError.message}</p>
          </div>
        )}

        {isRenounceConfirmed && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded text-sm">
            <p className="text-primary font-semibold mb-1">✓ Ownership Renounced</p>
            <p className="text-primary text-xs">Administrative privileges have been permanently removed</p>
            {renounceHash && (
              <p className="text-primary text-xs mt-1">
                TX: {renounceHash.slice(0, 10)}...{renounceHash.slice(-8)}
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Ownership History */}
      <Card className="bg-card border-border p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Ownership History</h3>
        <div className="text-center py-8">
          <p className="text-muted-foreground">No ownership changes recorded</p>
          <p className="text-muted-foreground text-sm mt-2">Ownership transfers will be logged here</p>
        </div>
      </Card>
    </div>
  )
}
