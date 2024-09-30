import { v4 as uuidv4 } from 'uuid';
import { Server, StableBTreeMap, ic, nat64, $query, $update } from 'azle';
import express from 'express';

/**
 * This type represents a proposal in the DAO.
 */
class Proposal {
    id: string;                // Unique proposal ID
    title: string;             // Title of the proposal
    description: string;       // Description of the proposal
    proposer: string;          // Address of the proposer
    votesFor: number;          // Number of votes in favor
    votesAgainst: number;      // Number of votes against
    status: 'Pending' | 'Accepted' | 'Rejected'; // Proposal status
    createdAt: nat64;          // Timestamp when the proposal was created
    updatedAt: nat64 | null;   // Timestamp when the proposal was last updated
    executionResult: string | null;  // Result of proposal execution, if any
}

// Storage for proposals
const proposalStorage = new StableBTreeMap<string, Proposal>(0, 44, 1024);

// Storage for DAO members (list of addresses)
const members = new Set<string>();

/**
 * Helper function to get the current time as a timestamp.
 */
function getCurrentTime(): nat64 {
    return ic.time() as nat64;
}

// Create a new proposal (only members can propose)
$update;
export function createProposal(proposer: string, title: string, description: string): string {
    if (!members.has(proposer)) {
        return `Error: Only DAO members can create proposals`;
    }

    const proposalId = uuidv4();
    const createdAt = getCurrentTime();

    const newProposal: Proposal = {
        id: proposalId,
        title,
        description,
        proposer,
        votesFor: 0,
        votesAgainst: 0,
        status: 'Pending',
        createdAt,
        updatedAt: null,
        executionResult: null
    };

    proposalStorage.insert(proposalId, newProposal);
    return `Proposal with id=${proposalId} has been created by ${proposer}`;
}

// Vote on a proposal (only members can vote)
$update;
export function voteOnProposal(proposalId: string, voter: string, voteFor: boolean): string {
    if (!members.has(voter)) {
        return `Error: Only DAO members can vote on proposals`;
    }

    const proposalOpt = proposalStorage.get(proposalId);
    if (proposalOpt === undefined) {
        return `Proposal with id=${proposalId} not found`;
    }

    const proposal = proposalOpt;
    if (proposal.status !== 'Pending') {
        return `Proposal with id=${proposalId} is no longer open for voting`;
    }

    const updatedVotesFor = voteFor ? proposal.votesFor + 1 : proposal.votesFor;
    const updatedVotesAgainst = !voteFor ? proposal.votesAgainst + 1 : proposal.votesAgainst;

    const updatedProposal: Proposal = {
        ...proposal,
        votesFor: updatedVotesFor,
        votesAgainst: updatedVotesAgainst,
        updatedAt: getCurrentTime(),
    };

    proposalStorage.insert(proposalId, updatedProposal);
    return `Vote registered: ${voteFor ? 'For' : 'Against'} for proposal id=${proposalId}`;
}

// Finalize proposal (only when voting is done)
$update;
export function finalizeProposal(proposalId: string): string {
    const proposalOpt = proposalStorage.get(proposalId);
    if (proposalOpt === undefined) {
        return `Proposal with id=${proposalId} not found`;
    }

    const proposal = proposalOpt;
    if (proposal.status !== 'Pending') {
        return `Proposal with id=${proposalId} has already been finalized`;
    }

    // Define the quorum and threshold for the DAO
    const quorum = 3; // Example: a minimum of 3 votes needed
    const threshold = 2; // Example: at least 2 votes in favor needed to pass

    const totalVotes = proposal.votesFor + proposal.votesAgainst;
    if (totalVotes < quorum) {
        return `Proposal with id=${proposalId} did not reach the quorum of ${quorum} votes`;
    }

    const status = proposal.votesFor >= threshold ? 'Accepted' : 'Rejected';
    const executionResult = status === 'Accepted' ? executeProposal(proposalId) : null;

    const finalizedProposal: Proposal = {
        ...proposal,
        status,
        updatedAt: getCurrentTime(),
        executionResult,
    };

    proposalStorage.insert(proposalId, finalizedProposal);
    return `Proposal with id=${proposalId} has been ${status}`;
}

// Execute a proposal (dummy execution in this example)
function executeProposal(proposalId: string): string {
    // Logic for executing the proposal goes here
    // For example, transfer funds, update policies, etc.
    return `Proposal id=${proposalId} executed successfully`;
}

// Add a new member to the DAO (admin functionality)
$update;
export function addMember(admin: string, newMember: string): string {
    // In a real scenario, we might check if the admin has rights to add members
    members.add(newMember);
    return `Member with address ${newMember} has been added to the DAO`;
}

// Get all proposals (public query)
$query;
export function getAllProposals(): Proposal[] {
    return proposalStorage.values();
}

// Get a proposal by ID
$query;
export function getProposalById(proposalId: string): Proposal | string {
    const proposalOpt = proposalStorage.get(proposalId);
    if (proposalOpt === undefined) {
        return `Proposal with id=${proposalId} not found`;
    }
    return proposalOpt;
}
