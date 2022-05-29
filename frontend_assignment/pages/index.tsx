import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers , Contract, utils } from "ethers"
import Head from "next/head"
import React, { useState, useEffect } from "react"
import styles from "../styles/Home.module.css"
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";

import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json";

export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")

    async function greet() {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello world"

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    // new greetings
    const [greeting, setGreeting] = useState("");
    useEffect(() => {
        const listenForGreeting = async () => {
          const provider = (await detectEthereumProvider()) as any;
          const ethers = new providers.Web3Provider(provider);
    
          const contract = new Contract(
            "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
            Greeter.abi,
            ethers
          );
    
          contract.on("NewGreeting", (greeting: string) => {
            setGreeting(utils.parseBytes32String(greeting));
          });
        };
    
        listenForGreeting().catch(console.error);
      }, []);

    // form
    interface IFormInputs {
        firstName: string;
        lastName: string;
        age: number;
        address: string;
    }

    const SignupSchema = yup
        .object({
            firstName: yup.string().required(),
            lastName: yup.string().defined(),
            age: yup.number().required().positive().integer(),
            address: yup.string().required()
        })
        .required();
    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<IFormInputs>({
        resolver: yupResolver(SignupSchema)
    });

    const onSubmit = (data: IFormInputs) => {
        alert(JSON.stringify(data));
    };

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div onClick={() => greet()} className={styles.button}>
                    Greet
                </div>

                <p className={styles.description}>New greetings below</p>
                <div className={styles.logs}>{greeting}</div>
                

                <div className={styles.logs}></div>

                <h1 className={styles.title}>Contact Us</h1>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div>
                        <label>First Name</label>
                        <input {...register("firstName")} />
                        {errors.firstName && <p>{errors.firstName.message}</p>}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label>Last Name</label>
                        <input {...register("lastName")} />
                        {errors.lastName && <p>{errors.lastName.message}</p>}
                    </div>
                    <div>
                        <label>Age</label>
                        <input type="number" {...register("age", { valueAsNumber: true })} />
                        {errors.age && <p>{errors.age.message}</p>}
                    </div>
                    <div>
                        <label>Address</label>
                        <input {...register("address")} />
                        {errors.address && <p>{errors.address.message}</p>}
                    </div>
                    <input type="submit" />
                </form>
            </main>

        </div>

    )
}